import type { Generator } from '../generator/domain/contracts.js';
import type { ArtifactEncoding } from '../generator/artifacts/artifact-set.js';

/** GEN-X01 — cross-module generator contribution. */
export type GeneratorCategory =
  | 'api'
  | 'database'
  | 'agent'
  | 'workflow'
  | 'integration'
  | 'configuration'
  | 'system'
  | 'package'
  | 'test';

export interface GeneratorContribution {
  readonly id: string;
  readonly moduleId: string;
  readonly version: string;
  readonly category: GeneratorCategory;
  readonly capabilities: readonly string[];
  readonly inputSchema: unknown;
  readonly outputKinds: readonly ArtifactEncoding[];
  readonly permissions: readonly string[];
  createGenerator(): Generator;
}

/** GEN-X02 — capability → generator resolution. */
export interface GenerationCapability {
  readonly capability: string;
  readonly generatorId: string;
  readonly moduleId: string;
  readonly version: string;
  readonly priority: number;
}

/** GEN-X03 — typed generation intents (AI/UI/Agent/Workflow all invoke these). */
export type GenerationIntent =
  | { readonly kind: 'api.endpoint'; readonly target: string; readonly operation: string; readonly requirements?: Readonly<Record<string, unknown>> }
  | { readonly kind: 'api.resource'; readonly name: string; readonly requirements?: Readonly<Record<string, unknown>> }
  | { readonly kind: 'agent.definition'; readonly role: string; readonly objective: string }
  | { readonly kind: 'workflow.definition'; readonly name: string; readonly stages: readonly string[] }
  | { readonly kind: 'database.schema'; readonly table: string; readonly fields: readonly string[] }
  | { readonly kind: 'integration.adapter'; readonly provider: string }
  | { readonly kind: 'configuration.draft'; readonly scope: string }
  | { readonly kind: 'os.profile'; readonly profileId: string }
  | { readonly kind: 'package.manifest'; readonly packageId: string }
  | { readonly kind: 'test.api'; readonly resource: string; readonly operations: readonly string[] };

/** GEN-X04 — context providers (Generator never imports every module). */
export interface GenerationContextProvider<T> {
  readonly namespace: string;
  resolve(request: unknown): Promise<T>;
}

/** GEN-X06 — generic generation targets (filesystem is one of many). */
export type GenerationTargetKind =
  | 'filesystem'
  | 'database'
  | 'configuration'
  | 'api-definition'
  | 'agent-definition'
  | 'workflow-definition'
  | 'marketplace-package'
  | 'system-image';

export interface GenerationTarget {
  readonly kind: GenerationTargetKind;
  readonly id: string;
}

export interface GenerationTargetAdapter<TTarget = unknown> {
  readonly kind: GenerationTargetKind;
  apply(target: GenerationTarget, artifacts: Readonly<{ path: string; content: string }[]>): Promise<unknown>;
}

/** GEN-X08 — permission bridge: generate vs apply are separate authorities. */
export interface GeneratorPermissionBridge {
  canGenerate(principalId: string, capability: string): Promise<boolean>;
  canApply(principalId: string, capability: string): Promise<boolean>;
}
