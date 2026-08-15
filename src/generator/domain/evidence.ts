import { hashParts } from './hash.js';

/**
 * GEN-006 — Determinism boundary.
 *
 * A generation run is reproducible when the same generator version + input
 * hash + configuration hash + template hashes produce the same output hash.
 * Secret values never enter the evidence; only their `secret://` references do.
 */
export interface GenerationEvidence {
  readonly generatorId: string;
  readonly generatorVersion: string;
  readonly inputHash: string;
  readonly configurationHash: string;
  readonly templateHashes: readonly { templateId: string; version: string; hash: string }[];
  readonly outputHash: string;
  readonly evidenceHash: string;
  readonly generatedAt: string;
}

export function buildEvidence(input: {
  readonly generatorId: string;
  readonly generatorVersion: string;
  readonly inputHash: string;
  readonly configurationHash: string;
  readonly templateHashes: readonly { templateId: string; version: string; hash: string }[];
  readonly outputHash: string;
}): GenerationEvidence {
  const evidence: GenerationEvidence = {
    generatorId: input.generatorId,
    generatorVersion: input.generatorVersion,
    inputHash: input.inputHash,
    configurationHash: input.configurationHash,
    templateHashes: input.templateHashes,
    outputHash: input.outputHash,
    evidenceHash: hashParts({
      generatorId: input.generatorId,
      generatorVersion: input.generatorVersion,
      inputHash: input.inputHash,
      configurationHash: input.configurationHash,
      templateHashes: input.templateHashes,
      outputHash: input.outputHash,
    }),
    generatedAt: new Date().toISOString(),
  };
  return evidence;
}
