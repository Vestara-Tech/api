/**
 * ARX-CP1 ARX-002/003/005/006/007 — Execution projection builder.
 *
 * Pure transform: DEX state → ActivityExecutionProjection.
 * No side effects. No external calls. Deterministic.
 *
 * This is the single transformation boundary between the DEX execution
 * platform and the Activity Room UI.
 */
import type {
  ActivityExecutionProjection,
  ActivityExecutionStatus,
  ActivityExecutionComplexity,
  ActivityParticipantProjection,
  ActivityRuntimeProjection,
  ActivityExecutionProgress,
  ActivityChangeSummary,
  ActivityFileChange,
  ActivityVerificationProjection,
  ActivityEvidenceProjection,
  ActivityTimelineEvent,
  ActivityConversationMessage,
  DeveloperExecutionPhase,
} from './contracts.js';
import { normalizeEvents } from './event-normalizer.js';
import { classifyComplexity } from './complexity-classifier.js';
import { filterConversationMessages } from './conversation-filter.js';

// ── Input Types ───────────────────────────────────────────────────

/** Minimal execution record needed for projection. */
export interface ExecutionRecord {
  readonly id: string;
  readonly status: string;
  readonly request?: {
    readonly goal?: string;
    readonly agentId?: string;
    readonly roomId?: string;
  };
  readonly events?: readonly {
    readonly id: string;
    readonly type: string;
    readonly at: string;
    readonly detail?: string;
    readonly actorId?: string;
  }[];
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly updatedAt?: string;
  readonly createdAt?: string;
}

/** DEX coordinator result (subset needed for projection). */
export interface CoordinatorResult {
  readonly executionId: string;
  readonly agentId: string;
  readonly outcome: string;
  readonly runtimeId: string;
  readonly sessionId?: string;
  readonly runtimeModel?: string;
  readonly changedFiles: readonly string[];
  readonly verification: {
    readonly conclusion: string;
    readonly freshness: string;
    readonly level?: string;
    readonly affectedModules?: readonly string[];
    readonly fingerprint?: string;
    readonly reasons?: readonly { kind: string; message: string }[];
  };
  readonly handoffEligible: boolean;
  readonly evidence?: {
    readonly evidenceHash: string;
    readonly outcome: string;
    readonly skills: readonly { id: string }[];
    readonly tools: readonly { id: string; granted: boolean; used: boolean }[];
  };
  readonly events: readonly {
    readonly type: string;
    readonly at: string;
    readonly name?: string;
    readonly text?: string;
    readonly path?: string;
    readonly detail?: string;
    readonly sessionId?: string;
    readonly runtime?: string;
    readonly model?: string;
  }[];
  readonly context?: {
    readonly identity?: { readonly agentId?: string };
    readonly governance?: { readonly skills?: readonly { readonly id: string }[] };
    readonly repository?: { readonly root?: string };
  };
}

// ── Projection Builder ────────────────────────────────────────────

/**
 * Build an ActivityExecutionProjection from an execution record
 * and an optional coordinator result.
 *
 * If only the execution record is provided (e.g. on reconnect before
 * the coordinator completes), the projection is constructed from
 * persisted state.
 */
export function buildProjection(
  execution: ExecutionRecord,
  coordinatorResult?: CoordinatorResult,
): ActivityExecutionProjection {
  const goal = execution.request?.goal ?? '';
  const status = coordinatorResult
    ? mapExecutionStatus(coordinatorResult.outcome === 'completed' ? 'completed' : coordinatorResult.outcome)
    : mapExecutionStatus(execution.status);
  const phase = derivePhase(execution, coordinatorResult);
  const complexity = classifyComplexity(goal);

  const participants = buildParticipants(execution, coordinatorResult);
  const runtime = coordinatorResult
    ? buildRuntime(coordinatorResult)
    : undefined;
  const progress = buildProgress(phase, coordinatorResult);
  const changes = buildChanges(coordinatorResult);
  const verification = buildVerification(coordinatorResult);
  const evidence = coordinatorResult?.evidence
    ? buildEvidence(coordinatorResult)
    : undefined;
  const timeline = buildTimeline(execution, coordinatorResult);
  const messages = buildMessages(execution, coordinatorResult);

  const result: ActivityExecutionProjection = {
    executionId: execution.id,
    goal,
    status,
    phase,
    complexity: complexity.level,
    participants,
    progress,
    changes,
    verification,
    timeline,
    messages,
    updatedAt: execution.updatedAt ?? execution.createdAt ?? new Date().toISOString(),
    ...(runtime ? { runtime } : {}),
    ...(evidence ? { evidence } : {}),
    ...(execution.startedAt ? { startedAt: execution.startedAt } : {}),
  };

  return result;
}

// ── Internal Builders ─────────────────────────────────────────────

function mapExecutionStatus(raw: string): ActivityExecutionStatus {
  const map: Record<string, ActivityExecutionStatus> = {
    requested: 'idle',
    analyzing: 'planning',
    planning: 'planning',
    'awaiting-approval': 'awaiting-approval',
    queued: 'running',
    running: 'running',
    blocked: 'failed',
    reviewing: 'verifying',
    verifying: 'verifying',
    completed: 'completed',
    failed: 'failed',
    cancelled: 'cancelled',
  };
  return map[raw] ?? 'idle';
}

function derivePhase(
  execution: ExecutionRecord,
  result?: CoordinatorResult,
): DeveloperExecutionPhase {
  if (result) {
    const phaseMap: Record<string, DeveloperExecutionPhase> = {
      completed: 'completed',
      failed: 'failed',
      cancelled: 'failed',
    };
    const outcomePhase = phaseMap[result.outcome];
    if (outcomePhase) return outcomePhase;

    // Determine from events.
    const types = new Set(result.events.map((e) => e.type));
    if (types.has('verification-started') || types.has('verification-completed')) return 'verifying';
    if (types.has('context-assembled') && !types.has('runtime-connected')) return 'inspecting';
    if (types.has('runtime-connected')) return 'implementing';
    if (types.has('plan-composed')) return 'planning';
    return 'implementing';
  }

  // No coordinator result — derive from execution record.
  const statusMap: Record<string, DeveloperExecutionPhase> = {
    requested: 'idle',
    analyzing: 'inspecting',
    planning: 'planning',
    running: 'implementing',
    reviewing: 'verifying',
    verifying: 'verifying',
    completed: 'completed',
    failed: 'failed',
    cancelled: 'failed',
  };
  return statusMap[execution.status] ?? 'idle';
}

function buildParticipants(
  execution: ExecutionRecord,
  result?: CoordinatorResult,
): readonly ActivityParticipantProjection[] {
  const agentId = execution.request?.agentId ?? result?.agentId ?? 'unknown';
  const participants: ActivityParticipantProjection[] = [];

  // Always show the developer agent.
  participants.push({
    role: 'developer',
    agentId,
    status: result
      ? result.outcome === 'completed' ? 'completed'
        : result.outcome === 'failed' ? 'failed'
        : 'active'
      : execution.status === 'running' ? 'active'
      : execution.status === 'completed' ? 'completed'
      : execution.status === 'failed' ? 'failed'
      : 'pending',
  });

  return participants;
}

function buildRuntime(result: CoordinatorResult): ActivityRuntimeProjection {
  return {
    id: result.runtimeId,
    ...(result.sessionId ? { sessionId: result.sessionId } : {}),
  };
}

function buildProgress(
  phase: DeveloperExecutionPhase,
  result?: CoordinatorResult,
): ActivityExecutionProgress {
  const phaseMessages: Record<DeveloperExecutionPhase, string> = {
    idle: 'Waiting to start',
    inspecting: 'Inspecting the repository...',
    planning: 'Planning implementation...',
    implementing: 'Implementing changes...',
    testing: 'Running tests...',
    verifying: 'Running verification...',
    completed: 'Implementation complete',
    failed: 'Execution failed',
  };

  const fileCount = result?.changedFiles.length ?? 0;

  return {
    phase,
    message: phaseMessages[phase],
  };
}

function buildChanges(result?: CoordinatorResult): ActivityChangeSummary {
  if (!result) {
    return { fileCount: 0, totalAdditions: 0, totalDeletions: 0, files: [] };
  }

  const files: ActivityFileChange[] = result.changedFiles.map((path) => ({
    path,
    status: 'modified' as const,
  }));

  return {
    fileCount: files.length,
    totalAdditions: 0,
    totalDeletions: 0,
    files,
  };
}

function buildVerification(result?: CoordinatorResult): ActivityVerificationProjection {
  if (!result) {
    return { status: 'pending', handoffEligible: false };
  }

  const conclusion = result.verification.conclusion;
  const freshness = result.verification.freshness;

  const status: ActivityVerificationProjection['status'] =
    conclusion === 'pass' ? 'passed'
    : conclusion === 'fail' ? 'failed'
    : conclusion === 'indeterminate' ? 'indeterminate'
    : 'running';

  return {
    status,
    handoffEligible: result.handoffEligible && freshness === 'current',
    ...(conclusion ? { conclusion: conclusion as 'pass' | 'fail' | 'indeterminate' } : {}),
    ...(freshness ? { freshness: freshness as 'current' | 'stale' } : {}),
    ...(result.verification.level ? { level: result.verification.level } : {}),
    ...(result.verification.affectedModules ? { modules: result.verification.affectedModules } : {}),
    ...(result.verification.fingerprint ? { fingerprint: result.verification.fingerprint } : {}),
    ...(result.verification.reasons !== undefined && result.verification.reasons.length > 0
      ? { reasons: result.verification.reasons }
      : {}),
  };
}

function buildEvidence(result: CoordinatorResult): ActivityEvidenceProjection {
  if (!result.evidence) {
    return { status: 'pending' };
  }

  return {
    status: 'recorded',
    hash: result.evidence.evidenceHash,
    outcome: result.evidence.outcome,
  };
}

function buildTimeline(execution: ExecutionRecord, result?: CoordinatorResult): readonly ActivityTimelineEvent[] {
  // Prefer coordinator events (they're the live DEX events).
  // Fall back to execution record events (persisted, for reconnect).
  const rawEvents = result?.events ?? execution.events ?? [];
  return normalizeEvents(rawEvents);
}

function buildMessages(
  execution: ExecutionRecord,
  result?: CoordinatorResult,
): readonly ActivityConversationMessage[] {
  const rawEvents = result?.events ?? execution.events ?? [];
  const normalized = rawEvents.map((e) => {
    const detail = (e as { detail?: string }).detail ?? (e as { text?: string }).text;
    const name = (e as { name?: string }).name;
    return {
      type: e.type,
      ...(detail ? { detail } : {}),
      ...(name ? { name } : {}),
      at: e.at,
    };
  });
  return filterConversationMessages(normalized).map((m) => ({
    id: `${m.kind}-${m.at}`,
    role: 'assistant' as const,
    parts: [{ type: 'text' as const, content: m.text }],
    at: m.at,
  }));
}
