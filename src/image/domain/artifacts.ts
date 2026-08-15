/** IMG-053/054/055/056 — SBOM, evidence bundle, signing, sealing. */

import { hashOf } from '../../generator/domain/hash.js';
import type { LockedPackage } from './package-lock.js';

export interface SbomEntry {
  readonly name: string;
  readonly version: string;
  readonly hash: string;
  readonly license?: string;
}

export interface SbomDocument {
  readonly format: 'spdx';
  readonly version: string;
  readonly packages: readonly SbomEntry[];
  readonly sbomHash: string;
  readonly generatedAt: string;
}

export interface EvidenceBundle {
  readonly buildId: string;
  readonly planHash: string;
  readonly sbomHash: string;
  readonly verificationHash?: string;
  readonly performanceHash?: string;
  readonly signing?: readonly { artifact: string; signature: string }[];
  readonly sealHash: string;
  readonly bundleHash: string;
  readonly generatedAt: string;
}

export interface SigningInput {
  readonly artifact: string;
  readonly payloadHash: string;
}

export interface SignatureResult {
  readonly artifact: string;
  readonly signature: string;
  readonly signer: string;
  readonly signedAt: string;
}

export interface SealResult {
  readonly imageHash: string;
  readonly sealHash: string;
  readonly sealedAt: string;
  readonly signatures: readonly SignatureResult[];
}

export interface SigningPolicy {
  readonly enabled: boolean;
  readonly keyId: string;
  readonly refuseUnsigned: boolean;
}

/**
 * IMG-053 — SBOM generation. A bill of materials over the locked packages.
 * Format SPDX 2.3 compatible.
 */
export function generateSbom(packages: readonly LockedPackage[]): SbomDocument {
  const entries: SbomEntry[] = packages.map((p) => ({ name: p.name, version: p.version, hash: p.hash }));
  return {
    format: 'spdx',
    version: '2.3',
    packages: entries,
    sbomHash: hashOf({ format: 'spdx', version: '2.3', packages: entries }),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * IMG-055 — Artifact signing. Signs a payload hash. With no private key in
 * the API process this is a deterministic signature over the payload; a real
 * backend would delegate to a key service. Policy can refuse unsigned builds.
 */
export function signArtifacts(inputs: readonly SigningInput[], policy: SigningPolicy): { signatures: readonly SignatureResult[]; refused: boolean; reason?: string } {
  if (policy.enabled === false) {
    const reason = policy.refuseUnsigned ? 'Signing disabled but policy refuses unsigned builds' : undefined;
    return { signatures: [], refused: policy.refuseUnsigned, ...(reason !== undefined ? { reason } : {}) };
  }
  const signatures: SignatureResult[] = inputs.map((input) => ({
    artifact: input.artifact,
    signature: `sig-${hashOf({ payloadHash: input.payloadHash, keyId: policy.keyId })}`,
    signer: policy.keyId,
    signedAt: new Date().toISOString(),
  }));
  return { signatures, refused: false };
}

/**
 * IMG-056 — Image sealing. The image is sealed with its hash and signatures,
 * making tampering detectable. Sealing is the last step before export.
 */
export function sealImage(input: { imageHash: string; signatures: readonly SignatureResult[] }): SealResult {
  const sealHash = hashOf({ imageHash: input.imageHash, signatures: input.signatures });
  return {
    imageHash: input.imageHash,
    sealHash,
    sealedAt: new Date().toISOString(),
    signatures: input.signatures,
  };
}

/**
 * IMG-054 — Evidence bundle. Assembles SBOM, verification, performance and
 * signatures into one verifiable bundle.
 */
export function buildEvidenceBundle(input: {
  buildId: string;
  planHash: string;
  sbomHash: string;
  verificationHash?: string;
  performanceHash?: string;
  signatures?: readonly SignatureResult[];
  sealHash: string;
}): EvidenceBundle {
  const bundle: EvidenceBundle = {
    buildId: input.buildId,
    planHash: input.planHash,
    sbomHash: input.sbomHash,
    ...(input.verificationHash !== undefined ? { verificationHash: input.verificationHash } : {}),
    ...(input.performanceHash !== undefined ? { performanceHash: input.performanceHash } : {}),
    ...(input.signatures !== undefined ? { signing: input.signatures.map((s) => ({ artifact: s.artifact, signature: s.signature })) } : {}),
    sealHash: input.sealHash,
    bundleHash: hashOf({
      buildId: input.buildId,
      planHash: input.planHash,
      sbomHash: input.sbomHash,
      verificationHash: input.verificationHash,
      performanceHash: input.performanceHash,
      signatures: input.signatures,
      sealHash: input.sealHash,
    }),
    generatedAt: new Date().toISOString(),
  };
  return bundle;
}
