export type {
  Generator,
  GenerationRequest,
  GenerationContext,
  GenerationResult,
  GenerationOutcome,
  GenerationLifecycleStatus,
} from './domain/contracts.js';
export type {
  GenerationStep,
  GenerationStepKind,
  GenerationRequirement,
  GenerationWarning,
  GenerationPlan,
} from './domain/plan.js';
export { createGenerationPlan, isPlanSatisfied } from './domain/plan.js';
export type { GenerationEvidence } from './domain/evidence.js';
export { buildEvidence } from './domain/evidence.js';
export { stableStringify, sha256, hashOf, hashParts } from './domain/hash.js';
export type { Artifact, ArtifactEncoding, ArtifactManifest, CreateArtifactInput } from './artifacts/artifact-set.js';
export { ArtifactSet, createArtifact } from './artifacts/artifact-set.js';
export type { ConfigurationSnapshot, ResolvedConfigValue, ConfigSecretReference } from './context/configuration-snapshot.js';
export { createConfigurationSnapshot } from './context/configuration-snapshot.js';
export type { TemplateDefinition, RenderContext, TemplateRenderer } from './templates/template-registry.js';
export { InMemoryTemplateRegistry, substitutionRenderer } from './templates/template-registry.js';
export type { CompatibilityResult } from './registry/generator-registry.js';
export { GeneratorRegistry } from './registry/generator-registry.js';
export type {
  GenerationServiceOptions,
  RunGenerationInput,
  PlannedGeneration,
  GenerationFlowOptions,
  AppliedGeneration,
} from './service/generation-service.js';
export { GenerationService } from './service/generation-service.js';
export type {
  DiffOperation,
  FileDiff,
  GenerationPreview,
  TargetDirectoryReader,
  BuildPreviewInput,
} from './preview/preview.js';
export { buildPreview } from './preview/preview.js';
export type {
  ArtifactValidationSeverity,
  ArtifactValidationIssue,
  ArtifactValidationResult,
  ArtifactValidationRule,
  ValidationPipelineOptions,
} from './validation/pipeline.js';
export { ArtifactValidationPipeline, assertSafePath, noRawSecretsRule } from './validation/pipeline.js';
export type { ApplyResult, ArtifactApplyPort, GovernedApplyOptions, VerificationResult, VerificationEvidence } from './apply/apply.js';
export { governedApply, verifyApply } from './apply/apply.js';
export type {
  GeneratorDescriptorForBuilder,
  GenerationReview,
  AppliedGenerationRecord,
  GenerationReviewDecision,
  DiffLine,
} from './domain/builder-contracts.js';
export { diffToLines } from './domain/builder-contracts.js';
