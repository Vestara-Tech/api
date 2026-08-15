import { notFound } from '../../core/errors.js';
import type {
  AiModel,
  AiModelRequirements,
  AiModelSelector,
  AiOptimizationProfile,
  ResolvedAiModel,
} from '../domain/contracts.js';
import type { AiModelCatalog } from '../catalog/model-catalog.js';
import type { AiProviderRegistry } from '../providers/provider-registry.js';

export interface RoutingConfig {
  readonly defaultProfile: AiOptimizationProfile;
  readonly enabledProviders: readonly string[];
}

/**
 * AI-012/013/014 — Model router. Resolves a selector (explicit provider/model
 * or capability requirements) to a concrete model, honoring provider
 * enablement, capability compatibility, context requirements, and the
 * optimization profile.
 */
export class ModelRouter {
  private readonly catalog: AiModelCatalog;
  private readonly providers: AiProviderRegistry;
  private readonly config: RoutingConfig;

  constructor(catalog: AiModelCatalog, providers: AiProviderRegistry, config: RoutingConfig) {
    this.catalog = catalog;
    this.providers = providers;
    this.config = config;
  }

  resolve(selector: AiModelSelector): ResolvedAiModel {
    if ('provider' in selector && selector.provider !== undefined && 'model' in selector && selector.model !== undefined) {
      return this.resolveExplicit(selector.provider, selector.model);
    }
    if ('requirements' in selector) {
      return this.resolveByRequirements(selector.requirements, selector.optimizeFor ?? this.config.defaultProfile);
    }
    throw notFound('AI model selector requires a provider/model or requirements');
  }

  private resolveExplicit(providerId: string, modelId: string): ResolvedAiModel {
    const entry = this.providers.adapterFor(providerId);
    if (!entry) throw notFound(`AI provider "${providerId}" is not enabled`);
    const model = this.catalog.get(providerId, modelId);
    return toResolved(model);
  }

  private resolveByRequirements(requirements: AiModelRequirements, profile: AiOptimizationProfile): ResolvedAiModel {
    const candidates = this.catalog
      .list()
      .filter((m) => this.providers.adapterFor(m.providerId) !== undefined)
      .filter((m) => matches(m, requirements))
      .filter((m) => this.config.enabledProviders.length === 0 || this.config.enabledProviders.includes(m.providerId));

    if (candidates.length === 0) {
      throw notFound('No enabled model satisfies the requested capabilities');
    }

    return toResolved(rank(candidates, profile));
  }

  async resolveAsync(selector: AiModelSelector): Promise<ResolvedAiModel> {
    return this.resolve(selector);
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
  if (requirements.input !== undefined && requirements.input.length > 0) {
    for (const modality of requirements.input) {
      if (!model.modalities.includes(modality)) return false;
    }
  }
  return true;
}

function rank(models: readonly AiModel[], profile: AiOptimizationProfile): AiModel {
  if (models.length === 1) return models[0]!;
  const score = (m: AiModel): number => {
    let s = 0;
    switch (profile) {
      case 'quality':
        s += m.capabilities.reasoning ? 4 : 0;
        s += m.capabilities.structuredOutput ? 2 : 0;
        s += m.contextWindow > 100_000 ? 2 : 0;
        break;
      case 'cost':
        s -= costOf(m);
        break;
      case 'latency':
        s -= m.openWeight ? 1 : 0; // prefer hosted for latency by default
        s += m.contextWindow < 32_000 ? 2 : 0;
        break;
      case 'local':
        s += m.openWeight ? 100 : 0;
        break;
      case 'offline':
        s += m.openWeight ? 100 : 0;
        break;
      case 'balanced':
      case 'auto':
      default:
        s += m.capabilities.reasoning ? 2 : 0;
        s += m.capabilities.structuredOutput ? 2 : 0;
        s -= costOf(m) / 100;
        break;
    }
    return s;
  };
  return [...models].sort((a, b) => score(b) - score(a))[0]!;
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
