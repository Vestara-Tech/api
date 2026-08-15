import { badRequest, forbidden } from '../../core/errors.js';
import { randomId } from '../../core/identifiers.js';
import { ArtifactSet } from '../artifacts/artifact-set.js';
import { createGenerationPlan, isPlanSatisfied, type GenerationPlan } from '../domain/plan.js';
import { buildEvidence, type GenerationEvidence } from '../domain/evidence.js';
import { hashOf } from '../domain/hash.js';
import type { ConfigurationSnapshot } from '../context/configuration-snapshot.js';
import type { Generator } from '../domain/contracts.js';
import type { GenerationContext, GenerationResult } from '../domain/contracts.js';
import type { TemplateDefinition } from '../templates/template-registry.js';
import type { GeneratorRegistry } from '../registry/generator-registry.js';
import type { ArtifactValidationResult } from '../validation/pipeline.js';
import type { GenerationPreview } from '../preview/preview.js';
import { buildPreview, type TargetDirectoryReader } from '../preview/preview.js';
import type { ApplyResult, VerificationResult } from '../apply/apply.js';
import { governedApply, verifyApply } from '../apply/apply.js';

export interface GenerationServiceOptions {
  readonly registry: GeneratorRegistry;
  /** Templates available to generators (id → template). */
  readonly templates: Readonly<Record<string, TemplateDefinition>>;
}

export interface RunGenerationInput<TInput> {
  readonly generatorId: string;
  readonly input: TInput;
  readonly configuration: ConfigurationSnapshot;
  readonly templateVersion?: string;
  readonly requestId?: string;
  readonly requiresSecrets?: boolean;
  readonly policyApprovedSecrets?: boolean;
}

export interface PlannedGeneration<TInput = unknown> {
  readonly plan: GenerationPlan;
  readonly generator: Generator<TInput>;
  readonly context: GenerationContext;
}

export interface GenerationFlowOptions<TInput> {
  readonly input: RunGenerationInput<TInput>;
  readonly targetReader: TargetDirectoryReader;
  readonly previewHash: string;
}

export interface AppliedGeneration<TOutput = unknown> {
  readonly result: GenerationResult<TOutput>;
  readonly validation: ArtifactValidationResult;
  readonly preview: GenerationPreview;
  readonly apply: ApplyResult;
  readonly verification: VerificationResult;
}

/**
 * Orchestrates `REQUEST → PLAN → GENERATE → ARTIFACT SET → EVIDENCE` for the
 * core milestone. Apply/verify/evidence pipelines arrive in GEN-007+.
 *
 * Secret rule: generators only receive a snapshot whose secret fields are
 * `secret://` references. Raw secret material is never handed to a generator;
 * a generator that declares `requiresSecrets` must also be policy-approved
 * (and even then, the snapshot `secretsResolved` flag controls resolution).
 */
export class GenerationService {
  private readonly registry: GeneratorRegistry;
  private readonly templates: Readonly<Record<string, TemplateDefinition>>;

  constructor(options: GenerationServiceOptions) {
    this.registry = options.registry;
    this.templates = options.templates;
  }

  /** Plan-only stage: return the plan + context without generating. */
  async plan<TInput>(input: RunGenerationInput<TInput>): Promise<PlannedGeneration<TInput>> {
    const generator = this.registry.get<TInput>(input.generatorId);
    const context = this.buildContext(input);
    const plan = await generator.plan(input.input, context);
    return { plan, generator, context };
  }

  async run<TInput, TOutput>(input: RunGenerationInput<TInput>): Promise<GenerationResult<TOutput>> {
    const { plan, generator, context } = await this.plan<TInput>(input);

    if (!isPlanSatisfied(plan)) {
      throw badRequest(`Generation plan for "${input.generatorId}" has unsatisfied requirements`, {
        requirements: plan.requirements.filter((r) => !r.satisfied).map((r) => r.label),
      });
    }

    // Enforce the secret rule.
    if (generator.requiresSecrets && !(input.policyApprovedSecrets === true)) {
      throw forbidden(`Generator "${generator.id}" requires secrets but policy did not approve them`);
    }

    const result = await generator.generate(input.input, context) as GenerationResult<TOutput>;
    const evidence = this.buildEvidence(input, generator, plan, result.artifacts);
    return { artifacts: result.artifacts, output: result.output, evidence };
  }

  /** GEN-007 — Preview: diff the artifact set against a target directory. */
  async preview<TOutput>(flow: GenerationFlowOptions<unknown>): Promise<GenerationPreview> {
    const result = await this.run<unknown, TOutput>(flow.input);
    return buildPreview({
      generatorId: result.evidence.generatorId,
      generatorVersion: result.evidence.generatorVersion,
      artifacts: result.artifacts,
      reader: flow.targetReader,
      previewHash: flow.previewHash,
    });
  }

  /**
   * GEN-009/010 — Governed end-to-end flow:
   * run → validate → preview → apply → verify.
   * `applyPort` and `approved` gate the actual filesystem write.
   */
  async applyFlow<TOutput>(
    flow: GenerationFlowOptions<unknown>,
    validation: { validate: (artifacts: ArtifactSet) => ArtifactValidationResult },
    applyPort: { write(path: string, content: string): Promise<void>; exists(path: string): Promise<boolean> },
    approved: boolean,
  ): Promise<AppliedGeneration<TOutput>> {
    const result = await this.run<unknown, TOutput>(flow.input);
    const validationResult = validation.validate(result.artifacts);
    if (!validationResult.ok) {
      throw badRequest('Artifact validation failed before apply', {
        issues: validationResult.issues.filter((i) => i.severity === 'error').map((i) => i.message),
      });
    }
    const preview = await buildPreview({
      generatorId: result.evidence.generatorId,
      generatorVersion: result.evidence.generatorVersion,
      artifacts: result.artifacts,
      reader: flow.targetReader,
      previewHash: flow.previewHash,
    });
    const apply = await governedApply(result.artifacts, { applyPort, approved });
    const verification = await verifyApply(result.artifacts, applyPort);
    return { result, validation: validationResult, preview, apply, verification };
  }

  private buildContext<TInput>(input: RunGenerationInput<TInput>): GenerationContext {
    const generator = this.registry.get<TInput>(input.generatorId);
    return {
      requestId: input.requestId ?? randomId('gen'),
      configuration: input.configuration,
      templates: this.templates,
      declaredSecretRequirement: generator.requiresSecrets,
      policyApprovedSecrets: input.policyApprovedSecrets === true,
    };
  }

  private buildEvidence(
    input: RunGenerationInput<unknown>,
    generator: Generator,
    plan: GenerationPlan,
    artifacts: ArtifactSet,
  ): GenerationEvidence {
    const inputHash = hashOf(input.input);
    const templateHashes = Object.values(this.templates).map((t) => ({
      templateId: t.id,
      version: t.version,
      hash: hashOf(t),
    }));
    return buildEvidence({
      generatorId: generator.id,
      generatorVersion: generator.version,
      inputHash,
      configurationHash: input.configuration.snapshotHash,
      templateHashes,
      outputHash: artifacts.outputHash(),
    });
  }
}

export { createGenerationPlan };
