/**
 * ARX-CP1 ARX-001 — Activity Room projection contracts.
 *
 * These types define the stable API/UI boundary for Activity Room
 * execution projections. They are a pure transform over DEX state.
 *
 * Rule: Do not send raw DEX/CAR/OpenCode objects to the UI.
 * This layer is the single transformation boundary.
 */

// ── Execution Status ──────────────────────────────────────────────

export type ActivityExecutionStatus =
  | 'idle'
  | 'planning'
  | 'running'
  | 'awaiting-approval'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled';

// ── Developer Execution Phase ─────────────────────────────────────

export type DeveloperExecutionPhase =
  | 'idle'
  | 'inspecting'
  | 'planning'
  | 'implementing'
  | 'testing'
  | 'verifying'
  | 'completed'
  | 'failed';

// ── Complexity ────────────────────────────────────────────────────

export type ActivityExecutionComplexity = 'simple' | 'standard' | 'complex';

// ── Participants ──────────────────────────────────────────────────

export interface ActivityParticipantProjection {
  readonly role: string;
  readonly agentId: string;
  readonly status: 'pending' | 'active' | 'completed' | 'failed' | 'waiting';
  readonly detail?: string;
}

// ── Runtime ───────────────────────────────────────────────────────

export interface ActivityRuntimeProjection {
  readonly id: string;
  readonly provider?: string;
  readonly model?: string;
  readonly sessionId?: string;
}

// ── Progress ──────────────────────────────────────────────────────

export interface ActivityExecutionProgress {
  readonly phase: DeveloperExecutionPhase;
  readonly message?: string;
  readonly percentComplete?: number;
}

// ── Changes ───────────────────────────────────────────────────────

export interface ActivityFileChange {
  readonly path: string;
  readonly status: 'added' | 'modified' | 'deleted' | 'renamed';
  readonly additions?: number;
  readonly deletions?: number;
}

export interface ActivityChangeSummary {
  readonly fileCount: number;
  readonly totalAdditions: number;
  readonly totalDeletions: number;
  readonly files: readonly ActivityFileChange[];
}

// ── Verification ──────────────────────────────────────────────────

export interface ActivityVerificationProjection {
  readonly status: 'pending' | 'running' | 'passed' | 'failed' | 'indeterminate';
  readonly conclusion?: 'pass' | 'fail' | 'indeterminate';
  readonly freshness?: 'current' | 'stale';
  readonly level?: string;
  readonly modules?: readonly string[];
  readonly fingerprint?: string;
  readonly handoffEligible: boolean;
}

// ── Evidence ──────────────────────────────────────────────────────

export interface ActivityEvidenceProjection {
  readonly status: 'pending' | 'recorded';
  readonly hash?: string;
  readonly outcome?: string;
  readonly recordedAt?: string;
}

// ── Timeline ──────────────────────────────────────────────────────

export interface ActivityTimelineEvent {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly detail?: string;
  readonly status: 'info' | 'success' | 'warning' | 'error';
  readonly at: string;
}

// ── Conversation Message ──────────────────────────────────────────

export type ActivityMessageRole = 'user' | 'assistant';

export type ActivityMessagePartType =
  | 'text'
  | 'execution-status'
  | 'workflow-progress'
  | 'verification-summary'
  | 'change-summary'
  | 'approval-request'
  | 'evidence-reference';

export interface ActivityMessagePart {
  readonly type: ActivityMessagePartType;
  readonly content: unknown;
}

export interface ActivityConversationMessage {
  readonly id: string;
  readonly role: ActivityMessageRole;
  readonly parts: readonly ActivityMessagePart[];
  readonly at: string;
}

// ── Top-Level Projection ──────────────────────────────────────────

export interface ActivityExecutionProjection {
  readonly executionId: string;
  readonly goal: string;

  readonly status: ActivityExecutionStatus;
  readonly phase: DeveloperExecutionPhase;
  readonly complexity: ActivityExecutionComplexity;

  readonly participants: readonly ActivityParticipantProjection[];

  readonly runtime?: ActivityRuntimeProjection;

  readonly progress: ActivityExecutionProgress;

  readonly changes: ActivityChangeSummary;

  readonly verification: ActivityVerificationProjection;

  readonly evidence?: ActivityEvidenceProjection;

  readonly timeline: readonly ActivityTimelineEvent[];

  readonly messages: readonly ActivityConversationMessage[];

  readonly startedAt?: string;
  readonly updatedAt: string;
}
