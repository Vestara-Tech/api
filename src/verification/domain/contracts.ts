/**
 * DEX-CP4 VCTRL-001 — Verification Control Plane domain contracts.
 *
 * These types define the stable vocabulary for verification governance.
 * They do NOT expose FASTVERIFY internals (VerificationReportSnapshot,
 * Evidence, etc.) — VCTRL interprets those through source adapters.
 */

// ── Purpose & Conclusion ───────────────────────────────────────────

export type VerificationPurpose =
  | 'developer-handoff'
  | 'review'
  | 'final-verification'
  | 'ci'
  | 'manual';

export type VerificationConclusion = 'pass' | 'fail' | 'indeterminate';

// ── Reason Classification (VCTRL-006) ─────────────────────────────

export type VerificationReasonKind =
  | 'change-failure'
  | 'baseline-failure'
  | 'infrastructure-failure'
  | 'insufficient-evidence'
  | 'policy-failure';

export interface VerificationReason {
  readonly kind: VerificationReasonKind;
  readonly message: string;
  readonly source?: string;
}

// ── Freshness (VCTRL-007) ─────────────────────────────────────────

export type VerificationFreshness = 'current' | 'stale';

// ── Request ────────────────────────────────────────────────────────

export interface VerificationRequest {
  readonly purpose: VerificationPurpose;
  readonly executionId?: string | undefined;
  readonly agentRunId?: string | undefined;
  readonly repositoryRoot: string;
  readonly baselineSha?: string | undefined;
  readonly changedFiles?: readonly string[] | undefined;
}

// ── Verdict ────────────────────────────────────────────────────────

export interface VerificationVerdict {
  readonly purpose: VerificationPurpose;
  readonly conclusion: VerificationConclusion;
  readonly freshness: VerificationFreshness;
  readonly level: string;
  readonly fingerprint?: string | undefined;
  readonly affectedModules: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly satisfiedEvidence: readonly string[];
  readonly missingEvidence: readonly string[];
  readonly sources: readonly VerificationSourceReference[];
  readonly reasons: readonly VerificationReason[];
}

export interface VerificationSourceReference {
  readonly sourceId: string;
  readonly level?: string | undefined;
  readonly result?: VerificationConclusion | undefined;
  readonly fingerprint?: string | undefined;
  readonly detail?: string | undefined;
}

// ── Plan ───────────────────────────────────────────────────────────

export interface VerificationPlan {
  readonly request: VerificationRequest;
  readonly sources: readonly VerificationSourcePlan[];
  readonly level: string;
  readonly reason: string;
}

export interface VerificationSourcePlan {
  readonly sourceId: string;
  readonly level: string;
  readonly reason: string;
}

// ── Source Outcome ─────────────────────────────────────────────────

export interface VerificationSourceOutcome {
  readonly sourceId: string;
  readonly conclusion: VerificationConclusion;
  readonly level: string;
  readonly fingerprint?: string | undefined;
  readonly affectedModules: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly satisfiedEvidence: readonly string[];
  readonly missingEvidence: readonly string[];
  readonly detail?: string | undefined;
  readonly reasons: readonly VerificationReason[];
}

// ── Control Plane Interface (VCTRL-004) ────────────────────────────

export interface VerificationControlPlane {
  analyze(request: VerificationRequest): Promise<VerificationPlan>;
  execute(plan: VerificationPlan): Promise<VerificationVerdict>;
  verify(request: VerificationRequest): Promise<VerificationVerdict>;
}

// ── Developer Execution Outcome (VCTRL-008) ───────────────────────

export interface DeveloperExecutionOutcome {
  readonly runtime: unknown;
  readonly verification: VerificationVerdict;
  readonly handoffEligible: boolean;
}
