import { createHash } from 'node:crypto';
import type { CodingExecutionEvidence } from './contracts.js';

/**
 * DEX-CP5 CAR-EVID-005 — Deterministic evidence hashing.
 *
 * Produces a SHA-256 hash over the evidence payload.
 * Excludes: evidenceHash itself, storage path, volatile metadata.
 * Includes: all actual evidence fields.
 *
 * Collections are sorted deterministically before hashing.
 */

/** Fields that participate in the hash. Order matters for determinism. */
interface HashableEvidence {
  readonly schemaVersion: number;
  readonly outcome: string;
  readonly execution: readonly [string, unknown][];
  readonly agent: readonly [string, unknown][];
  readonly runtime: readonly [string, unknown][];
  readonly model?: readonly [string, unknown][];
  readonly repository: readonly [string, unknown][];
  readonly skills: readonly [string, string][];
  readonly tools: readonly [string, boolean, boolean][];
  readonly verification: readonly [string, unknown][];
  readonly timing: readonly [string, unknown][];
}

function deterministicEntries(obj: Record<string, unknown>): readonly [string, unknown][] {
  return Object.keys(obj)
    .sort()
    .map((key) => [key, obj[key]] as [string, unknown]);
}

function deterministicSkills(skills: readonly { id: string; version: string }[]): readonly [string, string][] {
  return [...skills]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((s) => [s.id, s.version] as [string, string]);
}

function deterministicTools(tools: readonly { id: string; granted: boolean; used: boolean }[]): readonly [string, boolean, boolean][] {
  return [...tools]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((t) => [t.id, t.granted, t.used] as [string, boolean, boolean]);
}

function deterministicStrings(arr: readonly string[]): readonly string[] {
  return [...arr].sort();
}

function buildHashablePayload(evidence: CodingExecutionEvidence): HashableEvidence {
  const { evidenceHash: _excluded, ...rest } = evidence;

  return {
    schemaVersion: rest.schemaVersion,
    outcome: rest.outcome,
    execution: deterministicEntries(rest.execution as Record<string, unknown>),
    agent: deterministicEntries(rest.agent as Record<string, unknown>),
    runtime: deterministicEntries(rest.runtime as Record<string, unknown>),
    ...(rest.model !== undefined ? { model: deterministicEntries(rest.model as Record<string, unknown>) } : {}),
    repository: deterministicEntries({
      baselineSha: rest.repository.baselineSha ?? null,
      headSha: rest.repository.headSha ?? null,
      changedFiles: deterministicStrings(rest.repository.changedFiles).join(','),
      stateFingerprint: rest.repository.stateFingerprint ?? null,
    }),
    skills: deterministicSkills(rest.skills),
    tools: deterministicTools(rest.tools),
    verification: deterministicEntries({
      purpose: rest.verification.purpose,
      conclusion: rest.verification.conclusion,
      freshness: rest.verification.freshness,
      fingerprint: rest.verification.fingerprint ?? null,
      sourceEvidence: deterministicStrings(rest.verification.sourceEvidence).join(','),
      handoffEligible: rest.verification.handoffEligible,
    }),
    timing: deterministicEntries({ startedAt: rest.timing.startedAt, completedAt: rest.timing.completedAt, durationMs: rest.timing.durationMs }),
  };
}

/**
 * Compute a deterministic SHA-256 hash for a CodingExecutionEvidence payload.
 * The hash is computed over the evidence content, excluding the evidenceHash field itself.
 */
export function computeEvidenceHash(evidence: CodingExecutionEvidence): string {
  const payload = buildHashablePayload(evidence);
  const canonical = JSON.stringify(payload);
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}
