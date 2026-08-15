import type { ApiDefinition, ApiEndpoint, ApiField, ApiPolicy, ApiResource } from '../domain/types.js';

/**
 * AI Builder integration contracts.
 *
 * Design intent: AI is an OPTIONAL capability of the builder. It never creates
 * live Fastify routes or publishes directly. It produces typed patch proposals
 * against a known draft revision; a human reviews, edits, and approves.
 */

export interface ApiFieldPatch {
  readonly id?: string;
  readonly name?: string;
  readonly type?: ApiField['type'];
  readonly required?: boolean;
  readonly unique?: boolean;
  readonly enumValues?: readonly string[];
}

export interface ApiResourcePatch {
  readonly id?: string;
  readonly name?: string;
  readonly plural?: string;
  readonly fields?: readonly ApiFieldPatch[];
}

export interface ApiEndpointPatch {
  readonly id?: string;
  readonly method?: ApiEndpoint['method'];
  readonly path?: string;
  readonly summary?: string;
  readonly policyIds?: readonly string[];
}

export interface ApiPolicyPatch {
  readonly id?: string;
  readonly name?: string;
  readonly effect?: 'allow' | 'deny';
  readonly action?: string;
  readonly resource?: string;
}

/**
 * A typed, revision-scoped patch against an existing ApiDefinition draft.
 * The baseRevision must match the draft the UI is editing, preventing the AI
 * from proposing against a stale revision.
 */
export interface ApiDefinitionPatch {
  readonly baseRevision: number;
  readonly addResources?: readonly ApiResource[];
  readonly patchResources?: readonly ApiResourcePatch[];
  readonly removeResourceIds?: readonly string[];
  readonly addEndpoints?: readonly ApiEndpoint[];
  readonly patchEndpoints?: readonly ApiEndpointPatch[];
  readonly removeEndpointIds?: readonly string[];
  readonly addPolicies?: readonly ApiPolicy[];
  readonly patchPolicies?: readonly ApiPolicyPatch[];
  readonly removePolicyIds?: readonly string[];
  readonly setDescription?: string;
}

export interface AiBuilderProposal {
  readonly id: string;
  readonly intent: string;
  readonly baseRevision: number;
  readonly patch: ApiDefinitionPatch;
  readonly summary: string;
  readonly warnings: readonly string[];
  readonly confidence?: number;
  readonly createdAt: string;
}

export interface AiBuilderGenerateRequest {
  readonly intent: string;
  readonly base: ApiDefinition;
  readonly revision: number;
}

export interface AiBuilderModifyRequest {
  readonly intent: string;
  readonly base: ApiDefinition;
  readonly revision: number;
  readonly target?: { readonly kind: 'resource' | 'endpoint'; readonly id: string };
}

export interface AiBuilderReviewRequest {
  readonly definition: ApiDefinition;
  readonly focus?: 'security' | 'backward-compatibility' | 'consistency';
}

export interface AiBuilderReviewResult {
  readonly issues: readonly { readonly severity: 'error' | 'warning' | 'info'; readonly message: string; readonly path?: string }[];
}

/**
 * Provider-agnostic port. Builder code never knows about OpenAI, Claude,
 * OpenCode, LangChain, or individual model SDKs.
 */
export interface ApiBuilderAiPort {
  generate(request: AiBuilderGenerateRequest): Promise<AiBuilderProposal>;
  modify(request: AiBuilderModifyRequest): Promise<AiBuilderProposal>;
  review(request: AiBuilderReviewRequest): Promise<AiBuilderReviewResult>;
}
