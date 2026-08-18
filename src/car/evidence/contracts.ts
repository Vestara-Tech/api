/**
 * DEX-CP5 CAR-EVID-001 — Coding execution evidence contracts.
 *
 * These types describe what a Developer execution did, how it was
 * executed, what repository state it produced, and which VCTRL verdict
 * establishes its handoff status.
 *
 * Runtime-neutral: no @opencode-ai/sdk types.
 */

// ── Outcome (CAR-EVID-007) ────────────────────────────────────────

export type CodingExecutionOutcome =
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'blocked';

// ── Skill Evidence (CAR-EVID-002) ─────────────────────────────────

export interface CodingExecutionSkillEvidence {
  readonly id: string;
  readonly version: string;
}

// ── Tool Evidence (CAR-EVID-002) ──────────────────────────────────

export interface CodingExecutionToolEvidence {
  readonly id: string;
  readonly granted: boolean;
  readonly used: boolean;
}

// ── Verification Evidence (CAR-EVID-003) ──────────────────────────

export interface CodingExecutionVerificationEvidence {
  readonly purpose: string;
  readonly conclusion: 'pass' | 'fail' | 'indeterminate';
  readonly freshness: 'current' | 'stale';
  readonly fingerprint?: string | undefined;
  readonly sourceEvidence: readonly string[];
  readonly handoffEligible: boolean;
}

// ── Repository Evidence (CAR-EVID-004) ────────────────────────────

export interface CodingExecutionRepositoryEvidence {
  readonly baselineSha?: string | undefined;
  readonly headSha?: string | undefined;
  readonly changedFiles: readonly string[];
  readonly stateFingerprint?: string | undefined;
}

// ── Timing Evidence ───────────────────────────────────────────────

export interface CodingExecutionTimingEvidence {
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
}

// ── Top-Level Evidence Contract (CAR-EVID-001) ────────────────────

export interface CodingExecutionEvidence {
  readonly schemaVersion: 1;
  readonly outcome: CodingExecutionOutcome;
  readonly execution: {
    readonly executionId: string;
    readonly agentRunId: string;
    readonly objective?: string | undefined;
  };
  readonly agent: {
    readonly id: string;
    readonly role: string;
  };
  readonly runtime: {
    readonly id: string;
    readonly version?: string | undefined;
    readonly sessionId?: string | undefined;
  };
  readonly model?: {
    readonly providerId?: string | undefined;
    readonly modelId?: string | undefined;
  } | undefined;
  readonly repository: CodingExecutionRepositoryEvidence;
  readonly skills: readonly CodingExecutionSkillEvidence[];
  readonly tools: readonly CodingExecutionToolEvidence[];
  readonly verification: CodingExecutionVerificationEvidence;
  readonly timing: CodingExecutionTimingEvidence;
  readonly evidenceHash: string;
}

// ── Builder Input ─────────────────────────────────────────────────

export interface CodingExecutionEvidenceInput {
  readonly outcome: CodingExecutionOutcome;
  readonly execution: {
    readonly executionId: string;
    readonly agentRunId: string;
    readonly objective?: string | undefined;
  };
  readonly agent: {
    readonly id: string;
    readonly role: string;
  };
  readonly runtime: {
    readonly id: string;
    readonly version?: string | undefined;
    readonly sessionId?: string | undefined;
  };
  readonly model?: {
    readonly providerId?: string | undefined;
    readonly modelId?: string | undefined;
  } | undefined;
  readonly repository: {
    readonly baselineSha?: string | undefined;
    readonly headSha?: string | undefined;
    readonly changedFiles?: readonly string[] | undefined;
    readonly stateFingerprint?: string | undefined;
  };
  readonly skills?: readonly CodingExecutionSkillEvidence[] | undefined;
  readonly tools?: readonly CodingExecutionToolEvidence[] | undefined;
  readonly verification: {
    readonly purpose: string;
    readonly conclusion: 'pass' | 'fail' | 'indeterminate';
    readonly freshness: 'current' | 'stale';
    readonly fingerprint?: string | undefined;
    readonly sourceEvidence?: readonly string[] | undefined;
  };
  readonly timing: {
    readonly startedAt: string;
    readonly completedAt: string;
  };
}

// ── Storage Port (CAR-EVID-008) ───────────────────────────────────

export interface CodingExecutionEvidenceStore {
  save(evidence: CodingExecutionEvidence): Promise<void>;
  get(evidenceHash: string): Promise<CodingExecutionEvidence | null>;
}
