import type { AiModel, AiModality, AiModelCapabilities, AiModelPricing, AiProvider, AiProviderType } from '../domain/contracts.js';

/**
 * Raw shapes from the models.dev catalog (https://github.com/anomalyco/models.dev).
 * models.dev is a provider/model *metadata* catalog; Vestara uses it for
 * discovery + normalization only. Inference stays behind Vestara adapters.
 */
export interface ModelsDevProvider {
  readonly id: string;
  readonly name: string;
  readonly npm?: string;
  readonly env?: Record<string, string>;
  readonly api?: string;
  readonly baseURL?: string;
  readonly auth?: 'api' | 'bearer' | 'none' | 'x-api-key';
  readonly websites?: readonly string[];
  readonly models?: Record<string, ModelsDevModel>;
  readonly open?: boolean;
}

export interface ModelsDevModel {
  readonly id?: string;
  readonly name?: string;
  readonly description?: string;
  readonly reasoning?: boolean;
  readonly tool_call?: boolean;
  readonly structured_output?: boolean;
  readonly function_calling?: boolean;
  readonly vision?: boolean;
  readonly embedding?: boolean;
  readonly input?: readonly string[];
  readonly output?: readonly string[];
  readonly context?: number;
  readonly max_tokens?: number;
  readonly modalities?: readonly string[];
  readonly pricing?: {
    readonly input?: number;
    readonly output?: number;
    readonly cache_read?: number;
    readonly cache_write?: number;
  };
  readonly open_weights?: boolean;
  readonly release_date?: string;
  readonly lifecycle?: string;
  readonly limit?: { readonly context?: number };
}

export interface ModelsDevCatalog {
  readonly providers?: readonly ModelsDevProvider[];
  readonly models?: readonly ModelsDevModel[];
}

export interface ModelsDevCatalogAdapterOptions {
  readonly providers?: readonly AiProvider[];
  readonly openWeightOnly?: boolean;
}

/**
 * AI-005 — models.dev → Vestara normalized catalog mapper.
 */
export class ModelsDevCatalogAdapter {
  private readonly knownProviders: readonly AiProvider[];
  private readonly openWeightOnly: boolean;

  constructor(options: ModelsDevCatalogAdapterOptions = {}) {
    this.knownProviders = options.providers ?? [];
    this.openWeightOnly = options.openWeightOnly ?? false;
  }

  /** Map a models.dev catalog payload into normalized Vestara models. */
  toModels(catalog: ModelsDevCatalog): readonly AiModel[] {
    const models: AiModel[] = [];
    const providerIds = new Set(this.knownProviders.map((p) => p.id));

    for (const provider of catalog.providers ?? []) {
      const providerId = provider.id ?? provider.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      if (this.knownProviders.length > 0 && !providerIds.has(providerId)) continue;
      for (const [modelKey, raw] of Object.entries(provider.models ?? {})) {
        const model = this.mapModel(providerId, modelKey, raw);
        if (model) models.push(model);
      }
    }

    for (const raw of catalog.models ?? []) {
      const providerId = raw.id?.split('/')[0] ?? '';
      if (this.knownProviders.length > 0 && !providerIds.has(providerId)) continue;
      if (!raw.id) continue;
      const [prov, modelKey] = raw.id.split('/');
      const model = this.mapModel(prov ?? providerId, modelKey ?? raw.id, raw);
      if (model) models.push(model);
    }

    return models;
  }

  private mapModel(providerId: string, modelKey: string, raw: ModelsDevModel): AiModel | undefined {
    if (this.openWeightOnly && !raw.open_weights) return undefined;
    const id = raw.id?.split('/').pop() ?? raw.name ?? modelKey;
    const context = raw.context ?? raw.limit?.context ?? 0;
    const capabilities: AiModelCapabilities = {
      reasoning: raw.reasoning ?? false,
      tools: raw.tool_call ?? raw.function_calling ?? false,
      structuredOutput: raw.structured_output ?? false,
      functionCalling: raw.function_calling ?? raw.tool_call ?? false,
      vision: raw.vision ?? false,
      embeddings: raw.embedding ?? false,
      streaming: true,
    };
    const modalities = normalizeModalities(raw.input ?? raw.modalities ?? []);
    return {
      id,
      providerId,
      name: raw.name ?? id,
      ...(raw.description !== undefined ? { description: raw.description } : {}),
      capabilities,
      modalities,
      contextWindow: context,
      ...(raw.max_tokens !== undefined ? { maxOutputTokens: raw.max_tokens } : {}),
      ...(raw.pricing ? { pricing: normalizePricing(raw.pricing) } : {}),
      openWeight: raw.open_weights ?? false,
      lifecycleStatus: normalizeLifecycle(raw.lifecycle ?? raw.release_date),
      ...(raw.release_date ? { metadata: { releaseDate: raw.release_date } } : {}),
    };
  }
}

function normalizeModalities(input: readonly string[]): readonly AiModality[] {
  const map: Record<string, AiModality> = {
    text: 'text',
    image: 'image',
    audio: 'audio',
    video: 'video',
    document: 'document',
  };
  return input.map((i) => map[i.toLowerCase()] ?? 'text').filter((m, i, arr) => arr.indexOf(m) === i);
}

function normalizePricing(p: NonNullable<ModelsDevModel['pricing']>): AiModelPricing {
  return {
    ...(p.input !== undefined ? { inputPerMillion: p.input } : {}),
    ...(p.output !== undefined ? { outputPerMillion: p.output } : {}),
    ...(p.cache_read !== undefined ? { cacheReadPerMillion: p.cache_read } : {}),
    ...(p.cache_write !== undefined ? { cacheWritePerMillion: p.cache_write } : {}),
  };
}

function normalizeLifecycle(raw: string | undefined): AiModel['lifecycleStatus'] {
  if (!raw) return 'preview';
  const lower = raw.toLowerCase();
  if (lower.includes('deprecat')) return 'deprecated';
  if (lower.includes('beta')) return 'beta';
  if (lower.includes('ga') || lower.includes('release')) return 'ga';
  return 'preview';
}

export function toProviderType(raw: string | undefined, open: boolean | undefined): AiProviderType {
  if (open) return 'local';
  const lower = (raw ?? '').toLowerCase();
  if (lower.includes('openai')) return 'openai-compatible';
  if (lower.includes('ollama') || lower.includes('local')) return 'local';
  return 'native';
}

export function inferProviderType(models: readonly ModelsDevProvider[]): AiProviderType {
  const ids = models.map((p) => p.id.toLowerCase()).join(' ');
  if (ids.includes('openai') || ids.includes('openrouter')) return 'openai-compatible';
  if (ids.includes('ollama')) return 'local';
  return 'native';
}
