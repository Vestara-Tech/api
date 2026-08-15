import { createHash } from 'node:crypto';
import type { PackageArtifact } from '../contracts/package.js';

export interface ArtifactVerificationResult {
  readonly ok: boolean;
  readonly artifact?: string;
  readonly error?: string;
}

/**
 * MKT-011 — Artifact verification. Verifies a downloaded artifact's SHA-256
 * digest against the manifest before staging. Downloaded ≠ Installed.
 */
export class ArtifactVerifier {
  verify(artifact: PackageArtifact, content: Buffer | string): ArtifactVerificationResult {
    const digest = createHash('sha256').update(content).digest('hex');
    if (digest !== artifact.sha256) {
      return { ok: false, artifact: artifact.path, error: `sha256 mismatch: expected ${artifact.sha256.slice(0, 12)}… got ${digest.slice(0, 12)}…` };
    }
    return { ok: true, artifact: artifact.path };
  }
}
