/**
 * ARX-CP2 ARX-011 — Activity history recovery.
 *
 * Rebuilds an ActivityExecutionProjection from persisted authoritative
 * facts + monotonic event envelopes after a process restart. The read
 * side of the durable history; recorder.ts is the write side.
 *
 * The projection is reconstructed by mapping persisted events back onto
 * the coordinator-result shape the ARX-CP1 projection builder consumes.
 */

import type {
  ActivityExecutionProjection,
  ActivityExecutionStatus,
} from '../projection/contracts.js';
import { buildProjection } from '../projection/execution-projection.js';
import type { CoordinatorResult, ExecutionRecord } from '../projection/execution-projection.js';
import type {
  ActivityEvent,
  ActivityExecutionFact,
  ActivityHistoryStore,
} from './contracts.js';

export interface RecoveredExecution {
  readonly fact: ActivityExecutionFact;
  readonly projection: ActivityExecutionProjection;
}

/**
 * Recover a full execution projection from the durable history store.
 * Returns null if the execution has no persisted facts.
 */
export function recoverExecution(store: ActivityHistoryStore, executionId: string): RecoveredExecution | null {
  const fact = store.getExecution(executionId);
  if (!fact) return null;

  const events = store.events(executionId);
  const executionRecord = toExecutionRecord(fact, events);
  const coordinatorResult = toCoordinatorResult(fact, events);
  const base = buildProjection(executionRecord, coordinatorResult);
  const projection: ActivityExecutionProjection = {
    ...base,
    ...(fact.workflowId !== undefined ? { workflowId: fact.workflowId } : {}),
    ...(fact.workflowRunId !== undefined ? { workflowRunId: fact.workflowRunId } : {}),
  };

  return { fact, projection };
}

/**
 * Recover the event stream for an execution, optionally after a cursor.
 * Used by reconnect: "give me events after sequence 184".
 */
export function recoverEvents(
  store: ActivityHistoryStore,
  executionId: string,
  afterSequence?: number,
): readonly ActivityEvent[] {
  return store.events(executionId, afterSequence);
}

/**
 * The authoritative fact → projection input record.
 * Preserves goal/agent/status/timestamps from the persisted fact.
 */
function toExecutionRecord(fact: ActivityExecutionFact, events: readonly ActivityEvent[]): ExecutionRecord {
  const record: ExecutionRecord = {
    id: fact.executionId,
    status: toRawStatus(fact.status),
    request: {
      goal: fact.goal,
      agentId: fact.agentId,
      roomId: fact.roomId,
    },
    events: events.map((event) => ({
      id: event.id,
      type: event.type,
      at: event.occurredAt,
      ...(event.type === 'file-changed' ? { detail: event.payload.path } : {}),
    })),
    createdAt: fact.createdAt,
    updatedAt: fact.updatedAt,
    ...(fact.startedAt !== undefined ? { startedAt: fact.startedAt } : {}),
    ...(fact.completedAt !== undefined ? { completedAt: fact.completedAt } : {}),
  };
  return record;
}

/**
 * Rebuild the coordinator-result shape from persisted events.
 * Returns undefined when there is no completion evidence (execution
 * interrupted before producing a governed result).
 */
function toCoordinatorResult(fact: ActivityExecutionFact, events: readonly ActivityEvent[]): CoordinatorResult | undefined {
  const completed = findEvent(events, 'execution-completed');
  const failed = findEvent(events, 'execution-failed');
  const cancelled = findEvent(events, 'execution-cancelled');
  const verification = findEvent(events, 'verification-completed');
  const evidence = findEvent(events, 'evidence-recorded');
  const changedFiles = events.filter((event) => event.type === 'file-changed').map((event) => event.payload.path);

  if (!completed && !failed && !cancelled) {
    // Execution in progress or interrupted — no final governed result yet.
    return undefined;
  }

  const outcome =
    completed !== undefined ? 'completed' : failed !== undefined ? 'failed' : 'cancelled';

  const verificationPayload = verification?.type === 'verification-completed' ? verification.payload : undefined;
  const evidencePayload = evidence?.type === 'evidence-recorded' ? evidence.payload : undefined;

  return {
    executionId: fact.executionId,
    agentId: fact.agentId,
    outcome,
    runtimeId: 'persisted',
    ...(fact.runtimeSessionId !== undefined ? { sessionId: fact.runtimeSessionId } : {}),
    changedFiles: [...new Set(changedFiles)].sort(),
    verification: {
      conclusion: verificationPayload?.conclusion ?? 'indeterminate',
      freshness: verificationPayload?.freshness ?? 'current',
      ...(verificationPayload?.level !== undefined ? { level: verificationPayload.level } : {}),
      ...(verificationPayload?.modules !== undefined ? { affectedModules: verificationPayload.modules } : {}),
      ...(verificationPayload?.fingerprint !== undefined ? { fingerprint: verificationPayload.fingerprint } : {}),
      ...(verificationPayload?.reasons !== undefined && verificationPayload.reasons.length > 0
        ? { reasons: verificationPayload.reasons }
        : {}),
    },
    handoffEligible:
      completed?.type === 'execution-completed'
        ? completed.payload.handoffEligible
        : verificationPayload?.conclusion === 'pass' && verificationPayload?.freshness === 'current',
    ...(evidencePayload !== undefined
      ? {
          evidence: {
            evidenceHash: evidencePayload.evidenceHash,
            outcome: evidencePayload.outcome,
            skills: [],
            tools: [],
          },
        }
      : {}),
    events: events.map((event) => ({
      type: event.type,
      at: event.occurredAt,
      ...(event.type === 'file-changed' ? { path: event.payload.path } : {}),
      ...('text' in event.payload && typeof (event.payload as { text?: unknown }).text === 'string'
        ? { text: (event.payload as { text: string }).text }
        : {}),
    })),
  };
}

function findEvent(events: readonly ActivityEvent[], type: ActivityEvent['type']): (typeof events)[number] | undefined {
  return events.find((event) => event.type === type);
}

function toRawStatus(status: ActivityExecutionStatus): string {
  const map: Record<ActivityExecutionStatus, string> = {
    idle: 'requested',
    planning: 'planning',
    running: 'running',
    'awaiting-approval': 'awaiting-approval',
    verifying: 'verifying',
    completed: 'completed',
    failed: 'failed',
    cancelled: 'cancelled',
  };
  return map[status] ?? 'requested';
}