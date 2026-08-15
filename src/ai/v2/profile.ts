/** AI2-001 — AiProfile domain. Named, routable model configurations. */

import type { AiModelRequirements, AiOptimizationProfile } from '../domain/contracts.js';

export type AiRoutingStrategy =
  | 'fixed'
  | 'best-capability'
  | 'lowest-cost'
  | 'lowest-latency'
  | 'highest-reliability'
  | 'balanced'
  | 'local-first'
  | 'cloud-first'
  | 'privacy-first'
  | 'custom';

export type AiFallbackCondition = 'timeout' | 'rate-limit' | 'unavailable' | 'context-overflow' | 'provider-error';

export interface AiProfileModelRef {
  readonly providerId: string;
  readonly modelId: string;
}

export interface AiProfileFallbackChain {
  readonly primary: AiProfileModelRef;
  readonly fallbacks: readonly AiProfileModelRef[];
  /** Failover only on these conditions; never blindly retry semantic failures. */
  readonly failoverConditions: readonly AiFallbackCondition[];
}

export interface AiProfileParameters {
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly topP?: number;
  readonly presencePenalty?: number;
  readonly frequencyPenalty?: number;
}

export interface AiProfileBudgetHint {
  readonly maxCostPerRequestUsd?: number;
  readonly maxTokensPerRequest?: number;
}

export interface AiProfile {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly requirements: AiModelRequirements;
  readonly strategy: AiRoutingStrategy;
  readonly chain?: AiProfileFallbackChain;
  readonly parameters: AiProfileParameters;
  readonly budget?: AiProfileBudgetHint;
  readonly tags: readonly string[];
}

export interface AiProfileStorePort {
  save(profile: AiProfile): void;
  get(id: string): AiProfile | undefined;
  list(): readonly AiProfile[];
  remove(id: string): void;
}

export class InMemoryAiProfileStore implements AiProfileStorePort {
  private readonly profiles = new Map<string, AiProfile>();

  save(profile: AiProfile): void {
    this.profiles.set(profile.id, profile);
  }

  get(id: string): AiProfile | undefined {
    return this.profiles.get(id);
  }

  list(): readonly AiProfile[] {
    return [...this.profiles.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  remove(id: string): void {
    this.profiles.delete(id);
  }
}

/** Built-in profiles. Modules reference these names instead of provider/model ids. */
export function defaultAiProfiles(): readonly AiProfile[] {
  return [
    {
      id: 'vestara.reasoning',
      name: 'Reasoning',
      description: 'Best-quality reasoning with structured output.',
      requirements: { reasoning: true, structuredOutput: true, tools: true },
      strategy: 'best-capability',
      parameters: { temperature: 0.2, maxTokens: 16000 },
      budget: { maxTokensPerRequest: 16000 },
      tags: ['builtin', 'reasoning'],
    },
    {
      id: 'vestara.fast',
      name: 'Fast',
      description: 'Lowest-latency responses for interactive use.',
      requirements: { tools: true },
      strategy: 'lowest-latency',
      parameters: { temperature: 0.4, maxTokens: 4000 },
      budget: { maxTokensPerRequest: 4000 },
      tags: ['builtin', 'fast'],
    },
    {
      id: 'vestara.coding',
      name: 'Coding',
      description: 'Code generation with large context and tool calling.',
      requirements: { tools: true, functionCalling: true, minContext: 64000 },
      strategy: 'balanced',
      parameters: { temperature: 0.2, maxTokens: 16000 },
      budget: { maxTokensPerRequest: 16000 },
      tags: ['builtin', 'coding'],
    },
    {
      id: 'vestara.vision',
      name: 'Vision',
      description: 'Image + document understanding.',
      requirements: { vision: true, input: ['image'] },
      strategy: 'best-capability',
      parameters: { temperature: 0.2, maxTokens: 8000 },
      tags: ['builtin', 'vision'],
    },
    {
      id: 'vestara.embedding',
      name: 'Embedding',
      description: 'Embeddings for retrieval and context.',
      requirements: { embeddings: true },
      strategy: 'lowest-cost',
      parameters: {},
      tags: ['builtin', 'embedding'],
    },
    {
      id: 'vestara.background',
      name: 'Background',
      description: 'Low-cost processing for background/async work.',
      requirements: {},
      strategy: 'lowest-cost',
      parameters: { temperature: 0.6, maxTokens: 2000 },
      budget: { maxTokensPerRequest: 2000 },
      tags: ['builtin', 'background'],
    },
    {
      id: 'vestara.local-first',
      name: 'Local First',
      description: 'Prefer local/open-weight models; fall back to cloud.',
      requirements: { tools: true },
      strategy: 'local-first',
      parameters: { temperature: 0.3, maxTokens: 8000 },
      tags: ['builtin', 'local'],
    },
    {
      id: 'vestara.privacy-first',
      name: 'Privacy First',
      description: 'Never route to non-local providers.',
      requirements: {},
      strategy: 'privacy-first',
      parameters: { temperature: 0.3, maxTokens: 8000 },
      tags: ['builtin', 'privacy'],
    },
  ];
}
