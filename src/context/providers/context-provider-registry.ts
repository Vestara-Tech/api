import { conflict } from '../../core/errors.js';
import type { ContextProvider } from './context-provider.js';

/**
 * CTX-004 — Context provider registry. Every Vestara module contributes
 * through the contract; Context Core never imports each module directly.
 */
export class ContextProviderRegistry {
  private readonly providers = new Map<string, ContextProvider>();

  register(provider: ContextProvider): void {
    if (this.providers.has(provider.id)) throw conflict(`Context provider "${provider.id}" already registered`);
    this.providers.set(provider.id, provider);
  }

  get(id: string): ContextProvider {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`Context provider "${id}" not found`);
    return provider;
  }

  list(): readonly ContextProvider[] {
    return [...this.providers.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  listByKind(kind: ContextProvider['kinds'][number]): readonly ContextProvider[] {
    return this.list().filter((p) => p.kinds.includes(kind));
  }
}
