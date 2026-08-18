import type {
  CodingExecutionEvidence,
  CodingExecutionEvidenceInput,
  CodingExecutionVerificationEvidence,
  CodingExecutionTimingEvidence,
} from './contracts.js';
import { computeEvidenceHash } from './hash.js';

/**
 * DEX-CP5 CAR-EVID-006 — Evidence builder/finalizer.
 *
 * Constructs a finalized, immutable CodingExecutionEvidence from raw input.
 * Validates required fields, normalizes collections, derives handoff
 * eligibility, and calculates the evidence hash.
 *
 * Callers cannot construct evidence ad hoc — this is the only entry point.
 */
export function buildCodingExecutionEvidence(
  input: CodingExecutionEvidenceInput,
): CodingExecutionEvidence {
  // Validate required fields.
  if (!input.execution.executionId.trim()) {
    throw new Error('executionId is required');
  }
  if (!input.execution.agentRunId.trim()) {
    throw new Error('agentRunId is required');
  }
  if (!input.agent.id.trim()) {
    throw new Error('agent.id is required');
  }
  if (!input.agent.role.trim()) {
    throw new Error('agent.role is required');
  }
  if (!input.runtime.id.trim()) {
    throw new Error('runtime.id is required');
  }
  if (!input.timing.startedAt.trim()) {
    throw new Error('timing.startedAt is required');
  }
  if (!input.timing.completedAt.trim()) {
    throw new Error('timing.completedAt is required');
  }

  // Derive timing.
  const startedMs = new Date(input.timing.startedAt).getTime();
  const completedMs = new Date(input.timing.completedAt).getTime();
  const durationMs = completedMs - startedMs;

  if (durationMs < 0) {
    throw new Error('timing.completedAt must be after timing.startedAt');
  }

  const timing: CodingExecutionTimingEvidence = {
    startedAt: input.timing.startedAt,
    completedAt: input.timing.completedAt,
    durationMs,
  };

  // Normalize skills — deterministic order.
  const skills = [...(input.skills ?? [])].sort((a, b) => a.id.localeCompare(b.id));

  // Normalize tools — deterministic order.
  const tools = [...(input.tools ?? [])].sort((a, b) => a.id.localeCompare(b.id));

  // Normalize changed files — deterministic order.
  const changedFiles = [...(input.repository.changedFiles ?? [])].sort();

  // Normalize source evidence — deterministic order.
  const sourceEvidence = [...(input.verification.sourceEvidence ?? [])].sort();

  // Derive handoff eligibility from VCTRL verdict (CAR-EVID-006).
  const handoffEligible =
    input.verification.conclusion === 'pass' &&
    input.verification.freshness === 'current';

  const verification: CodingExecutionVerificationEvidence = {
    purpose: input.verification.purpose,
    conclusion: input.verification.conclusion,
    freshness: input.verification.freshness,
    fingerprint: input.verification.fingerprint,
    sourceEvidence,
    handoffEligible,
  };

  // Build the evidence without hash first.
  const evidence: Omit<CodingExecutionEvidence, 'evidenceHash'> = {
    schemaVersion: 1,
    outcome: input.outcome,
    execution: {
      executionId: input.execution.executionId,
      agentRunId: input.execution.agentRunId,
      objective: input.execution.objective,
    },
    agent: {
      id: input.agent.id,
      role: input.agent.role,
    },
    runtime: {
      id: input.runtime.id,
      version: input.runtime.version,
      sessionId: input.runtime.sessionId,
    },
    model: input.model,
    repository: {
      baselineSha: input.repository.baselineSha,
      headSha: input.repository.headSha,
      changedFiles,
      stateFingerprint: input.repository.stateFingerprint,
    },
    skills,
    tools,
    verification,
    timing,
  };

  // Calculate evidence hash.
  const evidenceHash = computeEvidenceHash(evidence as CodingExecutionEvidence);

  return { ...evidence, evidenceHash };
}
