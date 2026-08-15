/** BLD-X01/02/03 — generic Builder Platform contracts. */

export type BuilderDefinitionStatus =
  | 'draft'
  | 'validating'
  | 'ready'
  | 'publishing'
  | 'published'
  | 'invalid'
  | 'superseded'
  | 'archived';

export interface BuilderDefinitionMetadata {
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly author?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BuilderDefinition<TKind extends string = string, TSpec = unknown> {
  readonly id: string;
  readonly kind: TKind;
  readonly name: string;
  readonly revision: number;
  readonly status: BuilderDefinitionStatus;
  readonly spec: TSpec;
  readonly metadata: BuilderDefinitionMetadata;
}

export interface BuilderValidator<TSpec> {
  validate(spec: TSpec): { ok: boolean; issues: readonly { path: string; message: string; severity: 'error' | 'warning' }[] };
}

export interface BuilderCompiler<TSpec> {
  compile(spec: TSpec): unknown;
}

export interface BuilderContribution<TSpec = unknown> {
  readonly id: string;
  readonly moduleId: string;
  readonly kind: string;
  readonly version: string;
  readonly schema: unknown;
  readonly capabilities: readonly string[];
  readonly validator: BuilderValidator<TSpec>;
  readonly compiler?: BuilderCompiler<TSpec>;
  readonly generatorCapabilities?: readonly string[];
  readonly preferredEditor?: 'form' | 'graph' | 'code' | 'canvas' | 'hybrid';
}

export interface CreateBuilderDefinitionInput<TKind extends string = string, TSpec = unknown> {
  readonly id: string;
  readonly kind: TKind;
  readonly name: string;
  readonly spec: TSpec;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly author?: string;
}

/** BLD-X09..14 — bridges. */
export interface BuilderContextBridge<T = unknown> {
  resolve(definition: BuilderDefinition<string, unknown>): Promise<T>;
}

export interface BuilderPermissionBridge {
  canCreate(principalId: string, kind: string): Promise<boolean>;
  canPublish(principalId: string, kind: string): Promise<boolean>;
  canAiPropose(principalId: string, kind: string): Promise<boolean>;
  canGeneratorPreview(principalId: string, kind: string): Promise<boolean>;
  canGeneratorApply(principalId: string, kind: string): Promise<boolean>;
}

export interface BuilderAiPort {
  propose(request: { kind: string; intent: string; definition?: BuilderDefinition<string, unknown> }): Promise<BuilderProposal>;
  review(request: { kind: string; definition: BuilderDefinition<string, unknown> }): Promise<BuilderReview>;
}

export interface BuilderProposal {
  readonly summary: string;
  readonly changes: readonly string[];
}

export interface BuilderReview {
  readonly score: number;
  readonly findings: readonly { severity: 'error' | 'warning' | 'info'; message: string }[];
}
