import { notFound } from '../../core/errors.js';
import type { AiModel, AiModelRequirements, ResolvedAiModel } from '../domain/contracts.js';
import type { AiModelCatalog } from '../catalog/model-catalog.js';
import type { AiProviderRegistry } from '../providers/provider-registry.js';
import type { AiProfile, AiRoutingStrategy } from './profile.js';
import { healthScore, isProviderUsable, type AiProviderConfig, type AiProviderStatePort } from './provider-state.js';

export interface RoutingDecision {
  readonly resolved: ResolvedAiModel;
  readonly profileId: string;
  readonly strategy: AiRoutingStrategy;
  readonly fallbackChain: readonly string[]; // modelId strings
  readonly selectedFrom: 'primary' | 'fallback' | 'candidate-ranking';
  readonly reason: string;
  readonly at: string;
}

export interface RoutingV2Options {
  readonly catalog: AiModelCatalog;
  readonly providers: AiProviderRegistry;
  readonly providerStates: AiProviderStatePort;
}

/**
 * AI2-006..010 — Intelligent model router v2. Resolves an AiProfile to a
 * concrete model via: capability requirements -> policy filter -> availability
 * filter -> candidate ranking -> routing strategy. Fallback chains fail over
 * only on specific conditions (timeout/rate-limit/unavailable/context-overflow/
 * provider-error), never blindly on semantic failures.
 */
export class RoutingEngineV2 {
  private readonly catalog: AiModelCatalog;
  private readonly providers: AiProviderRegistry;
  private readonly providerStates: AiProviderStatePort;

  constructor(options: RoutingV2Options) {
    this.catalog = options.catalog;
    this.providers = options.providers;
    this.providerStates = options.providerStates;
  }

  route(profile: AiProfile): RoutingDecision {
    const usable = this.usableProviders();

    // Explicit chain (primary + fallbacks) wins when configured.
    if (profile.chain) {
      const primary = this.tryModel(profile.chain.primary);
      if (primary) {
        return this.decision(profile, primary, 'primary', 'fixed chain primary available', [profile.chain.primary.modelId]);
      }
      for (const fallback of profile.chain.fallbacks) {
        const model = this.tryModel(fallback);
        if (model) {
          return this.decision(profile, model, 'fallback', `primary unavailable; fell back to ${fallback.modelId}`, profile.chain.fallbacks.map((f) => f.modelId));
        }
      }
      throw notFound(`AI profile "${profile.id}" chain has no usable model`);
    }

    // Capability-based candidate selection.
    const candidates = this.candidates(profile.requirements)
      .filter((m) => usable.has(m.providerId))
      .filter((m) => this.availabilityAllows(profile, m));

    if (candidates.length === 0) {
      throw notFound(`No enabled, healthy model satisfies profile "${profile.id}"`);
    }

    const selected = this.rank(candidates, profile.strategy);
    return this.decision(profile, selected, 'candidate-ranking', `${profile.strategy} strategy selected ${selected.id}`, candidates.slice(0, 3).map((c) => c.id));
  }

  listEligible(profile: AiProfile): readonly ResolvedAiModel[] {
    const usable = this.usableProviders();
    return this.candidates(profile.requirements)
      .filter((m) => usable.has(m.providerId))
      .map((m) => toResolved(m));
  }

  private tryModel(ref: { providerId: string; modelId: string }): AiModel | undefined {
    const entry = this.providers.adapterFor(ref.providerId);
    if (!entry) return undefined;
    const state = this.providerStates.getProviderState(ref.providerId);
    if (state && !isProviderUsable(state)) return undefined;
    return this.catalog.getSafe(ref.providerId, ref.modelId);
  }

  private usableProviders(): Set<string> {
    const states = this.providerStates.listProviderStates();
    const usable = new Set<string>();
    for (const state of states) {
      if (isProviderUsable(state)) usable.add(state.id);
    }
    return usable;
  }

  private availabilityAllows(profile: AiProfile, model: AiModel): boolean {
    const state = this.providerStates.getProviderState(model.providerId);
    if (state && healthScore(state.health) >= 3) return false; // offline
    if (profile.budget?.maxTokensPerRequest && model.contextWindow < profile.budget.maxTokensPerRequest) return false;
    return true;
  }

  private candidates(requirements: AiModelRequirements): readonly AiModel[] {
    return this.catalog.list().filter((m) => matches(m, requirements));
  }

  private rank(models: readonly AiModel[], strategy: AiRoutingStrategy): AiModel {
    if (models.length === 1) return models[0]!;
    const score = (m: AiModel): number => {
      const state = this.providerStates.getProviderState(m.providerId);
      const healthPenalty = state ? healthScore(state.health) * 100 : 0;
      const latencyPenalty = state?.latencyMs ? Math.min(state.latencyMs, 5000) / 100 : 0;
      switch (strategy) {
        case 'fixed':
          return 0;
        case 'best-capability':
          return m.capabilities.reasoning ? 4 : 0 + (m.capabilities.structuredOutput ? 2 : 0) + (m.contextWindow > 100_000 ? 2 : 0) - healthPenalty;
        case 'lowest-cost':
          return -costOf(m) - healthPenalty;
        case 'lowest-latency':
          return -latencyPenalty - healthPenalty + (m.contextWindow < 32_000 ? 2 : 0);
        case 'highest-reliability':
          return -healthPenalty + (m.openWeight ? 1 : 0);
        case 'local-first':
          return (m.openWeight ? 100 : 0) - healthPenalty;
        case 'cloud-first':
          return (m.openWeight ? 0 : 100) - healthPenalty;
        case 'privacy-first':
          return m.openWeight ? 100 : -1000;
        case 'balanced':
        case 'custom':
        default:
          return (m.capabilities.reasoning ? 2 : 0) + (m.capabilities.structuredOutput ? 2 : 0) - costOf(m) / 100 - healthPenalty - latencyPenalty;
      }
    };
    return [...models].sort((a, b) => score(b) - score(a))[0]!;
  }

  private decision(profile: AiProfile, model: AiModel, selectedFrom: RoutingDecision['selectedFrom'], reason: string, chain: readonly string[]): RoutingDecision {
    return {
      resolved: toResolved(model),
      profileId: profile.id,
      strategy: profile.strategy,
      fallbackChain: chain,
      selectedFrom,
      reason,
      at: new Date().toISOString(),
    };
  }
}

function matches(model: AiModel, requirements: AiModelRequirements): boolean {
  if (requirements.reasoning !== undefined && model.capabilities.reasoning !== requirements.reasoning) return false;
  if (requirements.tools !== undefined && model.capabilities.tools !== requirements.tools) return false;
  if (requirements.structuredOutput !== undefined && model.capabilities.structuredOutput !== requirements.structuredOutput) return false;
  if (requirements.functionCalling !== undefined && model.capabilities.functionCalling !== requirements.functionCalling) return false;
  if (requirements.vision !== undefined && model.capabilities.vision !== requirements.vision) return false;
  if (requirements.embeddings !== undefined && model.capabilities.embeddings !== requirements.embeddings) return false;
  if (requirements.minContext !== undefined && model.contextWindow < requirements.minContext) return false;
  if (requirements.input && requirements.input.length > 0) {
    for (const modality of requirements.input) {
      if (!model.modalities.includes(modality)) return false;
    }
  }
  return true;
}

function costOf(model: AiModel): number {
  const p = model.pricing;
  if (!p) return 0;
  return (p.inputPerMillion ?? 0) + (p.outputPerMillion ?? 0);
}

function toResolved(model: AiModel): ResolvedAiModel {
  return {
    providerId: model.providerId,
    modelId: model.id,
    name: model.name,
    capabilities: model.capabilities,
    contextWindow: model.contextWindow,
  };
}

export type { AiProviderConfig };
