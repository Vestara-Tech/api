import type { ArtifactSet } from '../artifacts/artifact-set.js';
import type { GenerationPlan } from './plan.js';
import type { ConfigurationSnapshot } from '../context/configuration-snapshot.js';
import type { GenerationEvidence } from './evidence.js';

/**
 * The governed generation lifecycle shared by all generators and builders.
 * `REQUEST → PLAN → GENERATE → ARTIFACT SET → VALIDATE → PREVIEW/DIFF →
 * POLICY/APPROVAL → APPLY → VERIFY → EVIDENCE`.
 */
export type GenerationLifecycleStatus =
  | 'requested'
  | 'planning'
  | 'generating'
  | 'validating'
  | 'preview-ready'
  | 'awaiting-approval'
  | 'applying'
  | 'verifying'
  | 'completed'
  | 'failed';

export interface GenerationRequest<TInput> {
  readonly generatorId: string;
  readonly input: TInput;
  readonly templateVersion?: string;
  readonly requiresSecrets?: boolean;
}

/** Immutable context handed to a generator; never reaches into Configuration. */
export interface GenerationContext {
  readonly requestId: string;
  readonly configuration: ConfigurationSnapshot;
  /** Templates available to this generation run. */
  readonly templates: Readonly<Record<string, unknown>>;
  readonly declaredSecretRequirement: boolean;
  readonly policyApprovedSecrets: boolean;
}

export interface Generator<TInput = unknown, TOutput = unknown> {
  readonly id: string;
  readonly version: string;
  /** Capabilities this generator declares (e.g. 'secrets', 'templates', 'fs.apply'). */
  readonly capabilities: readonly string[];
  /** True when this generator may resolve secret material (policy-gated). */
  readonly requiresSecrets: boolean;

  plan(input: TInput, context: GenerationContext): Promise<GenerationPlan>;
  generate(input: TInput, context: GenerationContext): Promise<GenerationOutcome<TOutput>>;
}

/** What a generator produces; evidence is attached by the service. */
export interface GenerationOutcome<TOutput> {
  readonly artifacts: ArtifactSet;
  readonly output: TOutput;
}

export interface GenerationResult<TOutput> extends GenerationOutcome<TOutput> {
  readonly evidence: GenerationEvidence;
}
