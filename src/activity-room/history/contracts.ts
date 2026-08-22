/**
 * ARX-CP2 ARX-011 — Durable Activity history contracts.
 *
 * The Activity Room persists domain facts/events, not reconstructed UI
 * objects. These contracts define the authoritative event envelope and
 * the per-execution facts that survive process restart.
 *
 * Three concepts stay separate:
 *   1. Domain facts/events — authoritative, persisted here.
 *   2. Activity projection — human-readable current state, rebuilt
 *      from facts/events (see recovery.ts).
 *   3. Conversation messages — selected meaningful communication,
 *      derived during projection (conversation-filter.ts).
 */

import type {
  ActivityExecutionComplexity,
  ActivityExecutionStatus,
  ActivityParticipantProjection,
} from '../projection/contracts.js';

// ── Event Types ────────────────────────────────────────────────────

export type ActivityEventType =
  | 'execution-requested'
  | 'execution-started'
  | 'context-assembled'
  | 'runtime-connected'
  | 'session-created'
  | 'session-resumed'
  | 'file-changed'
  | 'tool-requested'
  | 'tool-completed'
  | 'runtime-completed'
  | 'verification-started'
  | 'verification-completed'
  | 'evidence-recorded'
  | 'execution-completed'
  | 'execution-blocked'
  | 'execution-failed'
  | 'execution-cancelled'
  | 'approval-requested'
  | 'approval-decided'
  | 'workflow-started'
  | 'workflow-progressed'
  | 'workflow-failed';

// ── Event Payloads ─────────────────────────────────────────────────

export interface ActivityEventPayloadMap {
  'execution-requested': {
    readonly goal: string;
    readonly agentId: string;
    readonly roomId: string;
    readonly complexity: ActivityExecutionComplexity;
  };
  'execution-started': {
    readonly runtimeId?: string | undefined;
  };
  'context-assembled': {
    readonly skills: readonly string[];
  };
  'runtime-connected': {
    readonly runtimeId: string;
    readonly sessionId: string;
    readonly model?: string | undefined;
  };
  'session-created': {
    readonly sessionId: string;
    readonly runtimeId: string;
    readonly model?: string | undefined;
  };
  'session-resumed': {
    readonly sessionId: string;
  };
  'file-changed': {
    readonly path: string;
  };
  'tool-requested': {
    readonly name: string;
  };
  'tool-completed': {
    readonly name: string;
    readonly ok: boolean;
  };
  'runtime-completed': {
    readonly runtimeId: string;
    readonly sessionId?: string | undefined;
    readonly changedFiles: readonly string[];
  };
  'verification-started': {
    readonly level?: string | undefined;
  };
  'verification-completed': {
    readonly conclusion: 'pass' | 'fail' | 'indeterminate';
    readonly freshness: 'current' | 'stale';
    readonly level?: string | undefined;
    readonly modules?: readonly string[] | undefined;
    readonly fingerprint?: string | undefined;
    readonly reasons?: readonly { kind: string; message: string }[] | undefined;
  };
  'evidence-recorded': {
    readonly evidenceHash: string;
    readonly outcome: string;
  };
  'execution-completed': {
    readonly outcome: string;
    readonly changedFiles: readonly string[];
    readonly handoffEligible: boolean;
  };
  'execution-blocked': {
    readonly reason: string;
    readonly reasons?: readonly { kind: string; message: string }[] | undefined;
    readonly changedFiles?: readonly string[] | undefined;
  };
  'execution-failed': {
    readonly error?: string | undefined;
  };
  'execution-cancelled': {
    readonly reason?: string | undefined;
  };
  'approval-requested': {
    readonly toolId: string;
    readonly risk: string;
    readonly reason?: string | undefined;
  };
  'approval-decided': {
    readonly toolId: string;
    readonly decision: 'approve' | 'reject';
    readonly decidedBy?: string | undefined;
  };
  'workflow-started': {
    readonly workflowId: string;
    readonly workflowRunId: string;
  };
  'workflow-progressed': {
    readonly workflowId: string;
    readonly workflowRunId: string;
    readonly stepId: string;
    readonly role: string;
  };
  'workflow-failed': {
    readonly workflowId: string;
    readonly workflowRunId: string;
    readonly error?: string | undefined;
  };
}

export type ActivityEventPayload = {
  [K in ActivityEventType]: ActivityEventPayloadMap[K];
}[ActivityEventType];

// ── Event Envelope ─────────────────────────────────────────────────

/**
 * Monotonically ordered Activity event envelope.
 *
 * `sequence` is a per-execution monotonic counter assigned by the store.
 * Reconnect and realtime transport read `events after N` via sequence.
 */
export interface ActivityEventEnvelope<TPayload> {
  readonly id: string;
  readonly executionId: string;
  readonly sequence: number;
  readonly occurredAt: string;
  readonly type: ActivityEventType;
  readonly payload: TPayload;
}

/** Typed envelope discriminated by event type. */
export type ActivityEvent = {
  [K in ActivityEventType]: ActivityEventEnvelope<ActivityEventPayloadMap[K]> & { readonly type: K };
}[ActivityEventType];

// ── Authoritative Execution Facts ──────────────────────────────────

/**
 * Authoritative per-execution references persisted by the store.
 * These are the domain facts the projection is rebuilt from —
 * not reconstructed UI objects.
 */
export interface ActivityExecutionFact {
  readonly executionId: string;
  readonly roomId: string;
  readonly goal: string;
  readonly agentId: string;
  readonly complexity: ActivityExecutionComplexity;
  readonly participants: readonly ActivityParticipantProjection[];
  readonly status: ActivityExecutionStatus;
  readonly createdAt: string;
  readonly startedAt?: string | undefined;
  readonly completedAt?: string | undefined;
  readonly updatedAt: string;
  readonly workflowId?: string | undefined;
  readonly workflowRunId?: string | undefined;
  readonly runtimeSessionId?: string | undefined;
  readonly verificationFingerprint?: string | undefined;
  readonly evidenceHash?: string | undefined;
}

// ── Store Interface ────────────────────────────────────────────────

/** Input for appending an event; the store assigns id/sequence. */
export interface ActivityEventInput {
  readonly executionId: string;
  readonly occurredAt: string;
  readonly type: ActivityEventType;
  readonly payload: ActivityEventPayload;
}

export interface ActivityHistoryStore {
  getExecution(executionId: string): ActivityExecutionFact | null;
  listExecutions(roomId?: string): readonly ActivityExecutionFact[];
  upsertExecution(fact: ActivityExecutionFact): ActivityExecutionFact;
  appendEvent(input: ActivityEventInput): ActivityEvent;
  events(executionId: string, afterSequence?: number): readonly ActivityEvent[];
  nextSequence(executionId: string): number;
}