/**
 * ARX-CP2 ARX-013 — Inspector view builder.
 *
 * Composes a moderate ActivityInspectorView from the recovered execution
 * (authoritative fact + cheap projection + monotonic event envelopes).
 * This is deliberately NOT a second source of execution state — every
 * field is derived from durable history. Heavy detail (full evidence,
 * verification reports, file diffs, context provenance) stays in the
 * lazy detail resolvers.
 */

import type {
  ActivityEvent,
  ActivityExecutionFact,
  ActivityHistoryStore,
} from '../history/contracts.js';
import type {
  ActivityExecutionProjection,
  ActivityRuntimeProjection,
} from '../projection/contracts.js';
import { recoverExecution } from '../history/recovery.js';
import type {
  ActivityInspectorChanges,
  ActivityInspectorContext,
  ActivityInspectorFileEntry,
  ActivityInspectorOverview,
  ActivityInspectorRuntime,
  ActivityInspectorTimelineEntry,
  ActivityInspectorVerification,
  ActivityInspectorView,
} from './contracts.js';

export interface ActivityInspectorSource {
  readonly fact: ActivityExecutionFact;
  readonly projection: ActivityExecutionProjection;
  readonly events: readonly ActivityEvent[];
}

/**
 * Build the cheap inspector source from the durable history store.
 * Returns null when the execution has no persisted facts.
 */
export function readInspectorSource(store: ActivityHistoryStore, executionId: string): ActivityInspectorSource | null {
  const recovered = recoverExecution(store, executionId);
  if (!recovered) return null;
  return {
    fact: recovered.fact,
    projection: recovered.projection,
    events: store.events(executionId),
  };
}

/**
 * Compose the moderate inspector view. Kept cheap: the projection is the
 * single projection source; only sequence-ordered envelopes are read for
 * the timeline. Full detail is resolved lazily by reference id.
 */
export function buildInspectorView(source: ActivityInspectorSource): ActivityInspectorView {
  const { fact, projection, events } = source;

  const overview: ActivityInspectorOverview = {
    executionId: fact.executionId,
    goal: projection.goal,
    status: projection.status,
    phase: projection.phase,
    complexity: projection.complexity,
    participants: projection.participants,
    ...(fact.workflowId !== undefined ? { workflowId: fact.workflowId } : {}),
    ...(fact.workflowRunId !== undefined ? { workflowRunId: fact.workflowRunId } : {}),
    ...(projection.startedAt !== undefined ? { startedAt: projection.startedAt } : {}),
    updatedAt: projection.updatedAt,
    ...(fact.completedAt !== undefined ? { completedAt: fact.completedAt } : {}),
  };

  return {
    executionId: fact.executionId,
    goal: projection.goal,
    overview,
    runtime: buildRuntime(fact, projection),
    context: buildContext(fact, events),
    changes: buildChanges(projection),
    verification: buildVerification(fact, projection),
    evidence: buildEvidence(fact, projection),
    timeline: buildTimeline(events),
  };
}

function buildRuntime(fact: ActivityExecutionFact, projection: ActivityExecutionProjection): ActivityInspectorRuntime {
  const runtime: ActivityRuntimeProjection | undefined = projection.runtime;
  const runtimeId = runtime?.id;
  const sessionId = runtime?.sessionId ?? fact.runtimeSessionId;
  const runtimeConnected = fact.runtimeSessionId !== undefined;

  return {
    ...(runtimeId !== undefined ? { runtimeId } : {}),
    ...(runtime?.provider !== undefined ? { provider: runtime.provider } : {}),
    ...(runtime?.model !== undefined ? { model: runtime.model } : {}),
    ...(sessionId !== undefined ? { sessionId } : {}),
    health: runtimeConnected ? 'connected' : runtimeId !== undefined ? 'unknown' : 'unavailable',
  };
}

function buildContext(fact: ActivityExecutionFact, events: readonly ActivityEvent[]): ActivityInspectorContext {
  const contextAssembled = events.find((event) => event.type === 'context-assembled');
  const skills = contextAssembled?.type === 'context-assembled' ? contextAssembled.payload.skills : [];

  const runtimeConnected = events.find((event) => event.type === 'runtime-connected');
  const provenance: string[] = [];
  if (contextAssembled) provenance.push('governance:context-assembled');
  if (runtimeConnected) provenance.push('runtime:connected');
  if (fact.workflowId !== undefined) provenance.push(`workflow:${fact.workflowId}`);
  if (fact.runtimeSessionId !== undefined) provenance.push(`session:${fact.runtimeSessionId}`);

  return {
    categories: [...new Set(events.map((event) => event.type).filter(isContextCategory))],
    skills: skills.map((id) => ({ id })),
    resourceCount: skills.length,
    provenance,
  };
}

function isContextCategory(type: string): boolean {
  return (
    type === 'context-assembled' ||
    type === 'runtime-connected' ||
    type === 'approval-requested' ||
    type === 'approval-decided'
  );
}

function buildChanges(projection: ActivityExecutionProjection): ActivityInspectorChanges {
  const files: ActivityInspectorFileEntry[] = projection.changes.files.map((file) => ({
    path: file.path,
    status: file.status,
    ...(file.additions !== undefined ? { additions: file.additions } : {}),
    ...(file.deletions !== undefined ? { deletions: file.deletions } : {}),
  }));
  return {
    fileCount: projection.changes.fileCount,
    files,
  };
}

function buildVerification(fact: ActivityExecutionFact, projection: ActivityExecutionProjection): ActivityInspectorVerification {
  const verification = projection.verification;
  return {
    status: verification.status,
    ...(verification.conclusion !== undefined ? { conclusion: verification.conclusion } : {}),
    ...(verification.freshness !== undefined ? { freshness: verification.freshness } : {}),
    ...(verification.level !== undefined ? { level: verification.level } : {}),
    selectedTests: 0,
    executedTests: 0,
    cached: 0,
    ...(verification.fingerprint !== undefined ? { fingerprint: verification.fingerprint } : {}),
    reasons: verification.reasons?.map((reason) => reason.message) ?? [],
    handoffEligible: verification.handoffEligible,
  };
}

function buildEvidence(fact: ActivityExecutionFact, projection: ActivityExecutionProjection): ActivityInspectorView['evidence'] {
  const evidence = projection.evidence;
  if (!evidence || evidence.status !== 'recorded' || evidence.hash === undefined) {
    return { status: 'pending' };
  }
  return {
    status: 'recorded',
    hash: evidence.hash,
    ...(evidence.outcome !== undefined ? { outcome: evidence.outcome } : {}),
    ...(fact.completedAt !== undefined ? { recordedAt: fact.completedAt } : {}),
  };
}

function buildTimeline(events: readonly ActivityEvent[]): readonly ActivityInspectorTimelineEntry[] {
  return events.map((event) => ({
    sequence: event.sequence,
    type: event.type,
    title: humanizeEventType(event.type),
    ...(eventDetail(event) !== undefined ? { detail: eventDetail(event) } : {}),
    at: event.occurredAt,
  }));
}

function humanizeEventType(type: string): string {
  const map: Record<string, string> = {
    'execution-requested': 'Execution requested',
    'execution-started': 'Execution started',
    'context-assembled': 'Context assembled',
    'runtime-connected': 'Runtime connected',
    'session-created': 'Developer session created',
    'session-resumed': 'Developer session resumed',
    'file-changed': 'File changed',
    'tool-requested': 'Tool requested',
    'tool-completed': 'Tool completed',
    'runtime-completed': 'Developer runtime completed',
    'verification-started': 'Verification started',
    'verification-completed': 'Verification completed',
    'evidence-recorded': 'Evidence recorded',
    'execution-completed': 'Execution completed',
    'execution-blocked': 'Execution blocked',
    'execution-failed': 'Execution failed',
    'execution-cancelled': 'Execution cancelled',
    'approval-requested': 'Approval requested',
    'approval-decided': 'Approval decided',
    'workflow-started': 'Workflow started',
    'workflow-progressed': 'Workflow progressed',
    'workflow-failed': 'Workflow failed',
  };
  return map[type] ?? type.replace(/-/g, ' ');
}

function eventDetail(event: ActivityEvent): string | undefined {
  if (event.type === 'file-changed') return event.payload.path;
  if (event.type === 'context-assembled') return `${event.payload.skills.length} skill(s) loaded`;
  if (event.type === 'runtime-connected') {
    const model = event.payload.model;
    const runtime = event.payload.runtimeId;
    return model !== undefined ? `${runtime} · ${model}` : runtime;
  }
  if (event.type === 'session-created') {
    const model = event.payload.model;
    const runtime = event.payload.runtimeId;
    const identity = `${runtime} · ${event.payload.sessionId}`;
    return model !== undefined ? `${identity} · ${model}` : identity;
  }
  if (event.type === 'session-resumed') return event.payload.sessionId;
  if (event.type === 'tool-requested') return event.payload.name;
  if (event.type === 'tool-completed') return `${event.payload.name} · ${event.payload.ok ? 'ok' : 'failed'}`;
  if (event.type === 'runtime-completed') {
    const runtime = event.payload.runtimeId;
    const changed = event.payload.changedFiles.length;
    return `${runtime} · ${changed} file${changed === 1 ? '' : 's'} changed`;
  }
  if (event.type === 'verification-completed') {
    const reasons = event.payload.reasons?.map((reason) => reason.message);
    const conclusion = `${event.payload.conclusion} · ${event.payload.freshness}`;
    return reasons !== undefined && reasons.length > 0 ? `${conclusion} — ${reasons[0]}` : conclusion;
  }
  if (event.type === 'evidence-recorded') return event.payload.evidenceHash;
  if (event.type === 'execution-blocked') return event.payload.reason;
  if (event.type === 'execution-failed' && event.payload.error !== undefined) return event.payload.error;
  if (event.type === 'execution-cancelled' && event.payload.reason !== undefined) return event.payload.reason;
  if (event.type === 'workflow-started') return `run ${event.payload.workflowRunId}`;
  if (event.type === 'workflow-progressed') return `${event.payload.role}:${event.payload.stepId} (run ${event.payload.workflowRunId})`;
  if (event.type === 'workflow-failed') return event.payload.error ?? `run ${event.payload.workflowRunId}`;
  return undefined;
}