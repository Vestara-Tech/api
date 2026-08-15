import { conflict, notFound } from '../../core/errors.js';
import type { AiProvider } from '../domain/contracts.js';
import type { AiProviderAdapter, AiProviderAdapterRegistration } from './provider-adapter.js';

/**
 * AI-003 — Provider registry. Holds enabled providers and their adapters.
 * Provider configuration is data, not code.
 */
export class AiProviderRegistry {
  private readonly providers = new Map<string, AiProvider>();
  private readonly adapters = new Map<string, AiProviderAdapter>();

  register(registration: AiProviderAdapterRegistration): void {
    const { provider, adapter } = registration;
    if (this.providers.has(provider.id)) throw conflict(`AI provider "${provider.id}" already registered`);
    this.providers.set(provider.id, provider);
    this.adapters.set(provider.id, adapter);
  }

  updateProvider(provider: AiProvider): void {
    const existing = this.providers.get(provider.id);
    if (!existing) throw notFound(`AI provider "${provider.id}" not found`);
    this.providers.set(provider.id, provider);
  }

  getProvider(id: string): AiProvider {
    const provider = this.providers.get(id);
    if (!provider) throw notFound(`AI provider "${id}" not found`);
    return provider;
  }

  getAdapter(id: string): AiProviderAdapter {
    const adapter = this.adapters.get(id);
    if (!adapter) throw notFound(`AI provider adapter "${id}" not found`);
    return adapter;
  }

  listProviders(): readonly AiProvider[] {
    return [...this.providers.values()].sort((a, b) => a.priority - b.priority);
  }

  listEnabledProviders(): readonly AiProvider[] {
    return this.listProviders().filter((p) => p.enabled);
  }

  /** Adapter for a provider id (enabled only). */
  adapterFor(providerId: string): { provider: AiProvider; adapter: AiProviderAdapter } | undefined {
    const provider = this.providers.get(providerId);
    if (!provider || !provider.enabled) return undefined;
    const adapter = this.adapters.get(providerId);
    if (!adapter) return undefined;
    return { provider, adapter };
  }
}
