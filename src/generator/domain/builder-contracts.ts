import type { ArtifactManifest } from '../artifacts/artifact-set.js';
import type { GenerationEvidence } from '../domain/evidence.js';
import type { GenerationPreview, FileDiff } from '../preview/preview.js';
import type { ArtifactValidationResult } from '../validation/pipeline.js';
import type { ApplyResult, VerificationResult } from '../apply/apply.js';

/**
 * GEN-012 — Generator Builder contracts.
 *
 * A reusable generation workspace surface: what the Builder UI renders and the
 * Review & Apply flow consumes. Independent of any specific generator.
 */

export interface GeneratorDescriptorForBuilder {
  readonly id: string;
  readonly version: string;
  readonly capabilities: readonly string[];
  readonly requiresSecrets: boolean;
  readonly compatible: boolean;
  readonly missingCapabilities?: readonly string[];
}

export interface GenerationReview {
  readonly generationId: string;
  readonly generator: { id: string; version: string };
  readonly planSummary: {
    readonly stepCount: number;
    readonly requirementCount: number;
    readonly satisfied: boolean;
    readonly warningCount: number;
  };
  readonly validation: ArtifactValidationResult;
  readonly preview: GenerationPreview;
  readonly manifest: ArtifactManifest;
  readonly evidence: GenerationEvidence;
}

export interface AppliedGenerationRecord {
  readonly generationId: string;
  readonly review: GenerationReview;
  readonly apply: ApplyResult;
  readonly verification: VerificationResult;
  readonly appliedAt: string;
}

export interface GenerationReviewDecision {
  readonly generationId: string;
  readonly decision: 'approved' | 'rejected' | 'modified';
  readonly actor?: string;
  readonly note?: string;
}

/** Presentation-friendly diff line for the Builder review panel. */
export interface DiffLine {
  readonly path: string;
  readonly operation: FileDiff['operation'];
  readonly added: number;
  readonly removed: number;
  readonly unchanged: boolean;
}

export function diffToLines(diff: readonly FileDiff[]): readonly DiffLine[] {
  return diff.map((d) => ({
    path: d.path,
    operation: d.operation,
    added: d.addedLines,
    removed: d.removedLines,
    unchanged: d.operation === 'unchanged',
  }));
}
