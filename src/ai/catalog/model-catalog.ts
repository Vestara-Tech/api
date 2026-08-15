import { notFound } from '../../core/errors.js';
import type { AiModel } from '../domain/contracts.js';

export interface AiModelCatalogOptions {
  readonly models?: readonly AiModel[];
}

/**
 * AI-004 — Normalized model catalog. Populated from models.dev (via adapter)
 * and/or explicit registrations. Vestara models Vestara's own normalized
 * `AiModel` shape; models.dev is the metadata source, not the runtime.
 */
export class AiModelCatalog {
  private readonly models = new Map<string, AiModel>();

  constructor(options: AiModelCatalogOptions = {}) {
    for (const model of options.models ?? []) this.upsert(model);
  }
  upsert(model: AiModel): void {
    this.models.set(catalogKey(model.providerId, model.id), model);
  }

  get(providerId: string, modelId: string): AiModel {
    const model = this.models.get(catalogKey(providerId, modelId));
    if (!model) throw notFound(`AI model "${providerId}/${modelId}" not found in catalog`);
    return model;
  }

  has(providerId: string, modelId: string): boolean {
    return this.models.has(catalogKey(providerId, modelId));
  }

  getSafe(providerId: string, modelId: string): AiModel | undefined {
    return this.models.get(catalogKey(providerId, modelId));
  }

  list(): readonly AiModel[] {
    return [...this.models.values()].sort((a, b) => a.providerId.localeCompare(b.providerId) || a.id.localeCompare(b.id));
  }

  listByProvider(providerId: string): readonly AiModel[] {
    return this.list().filter((m) => m.providerId === providerId);
  }

  clear(): void {
    this.models.clear();
  }
}

export function catalogKey(providerId: string, modelId: string): string {
  return `${providerId}/${modelId}`;
}
