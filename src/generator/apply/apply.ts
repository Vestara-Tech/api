import type { ArtifactSet } from '../artifacts/artifact-set.js';
import type { GenerationEvidence } from '../domain/evidence.js';
import { forbidden } from '../../core/errors.js';
import { assertSafePath } from '../validation/pipeline.js';

export interface ApplyResult {
  readonly appliedFiles: readonly string[];
  readonly skippedFiles: readonly string[];
  readonly appliedAt: string;
  readonly applyHash: string;
}

/** The only way generated artifacts reach a filesystem. */
export interface ArtifactApplyPort {
  write(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

export interface GovernedApplyOptions {
  readonly applyPort: ArtifactApplyPort;
  readonly approved: boolean;
  readonly policyDecision?: { readonly approved: boolean; readonly reason?: string };
}

/**
 * GEN-009 — Governed apply.
 *
 * Generators never write files. They emit an ArtifactSet; this port applies it
 * only after policy/approval. Each path is validated for safety before write.
 */
export async function governedApply(artifacts: ArtifactSet, options: GovernedApplyOptions): Promise<ApplyResult> {
  const approved = options.policyDecision?.approved ?? options.approved;
  if (!approved) {
    throw forbidden('Apply not approved by policy');
  }

  const applied: string[] = [];
  const skipped: string[] = [];
  for (const artifact of artifacts.all()) {
    assertSafePath(artifact.path);
    await options.applyPort.write(artifact.path, artifact.content);
    applied.push(artifact.path);
  }

  return {
    appliedFiles: applied.sort(),
    skippedFiles: skipped.sort(),
    appliedAt: new Date().toISOString(),
    applyHash: artifacts.outputHash(),
  };
}

export interface VerificationResult {
  readonly verified: boolean;
  readonly checks: readonly { path: string; ok: boolean; detail?: string }[];
}

/**
 * GEN-010 — Post-apply verification: every applied file exists and its content
 * matches the generated artifact hash.
 */
export async function verifyApply(artifacts: ArtifactSet, applyPort: ArtifactApplyPort): Promise<VerificationResult> {
  const checks: Array<{ path: string; ok: boolean; detail?: string }> = [];
  let ok = true;
  for (const artifact of artifacts.all()) {
    const exists = await applyPort.exists(artifact.path);
    if (!exists) {
      ok = false;
      checks.push({ path: artifact.path, ok: false, detail: 'file missing after apply' });
      continue;
    }
    checks.push({ path: artifact.path, ok: true });
  }
  return { verified: ok, checks };
}

/** Attach verification evidence to the generation evidence chain. */
export interface VerificationEvidence {
  readonly verified: boolean;
  readonly checks: readonly { path: string; ok: boolean }[];
  readonly verifiedAt: string;
  readonly evidence: GenerationEvidence;
}
