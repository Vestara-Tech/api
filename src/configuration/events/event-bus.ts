import type { ConfigurationChangeEvent, ConfigurationChangeListener, ConfigurationScopeLike } from './types.js';

export class ConfigurationEventBus {
  private readonly listeners = new Map<string, Set<ConfigurationChangeListener>>();

  subscribe(scope: ConfigurationScopeLike, listener: ConfigurationChangeListener): () => void {
    const key = String(scope);
    const set = this.listeners.get(key) ?? new Set<ConfigurationChangeListener>();
    set.add(listener);
    this.listeners.set(key, set);
    return () => {
      set.delete(listener);
    };
  }

  publish(event: ConfigurationChangeEvent): void {
    const set = this.listeners.get(String(event.scope));
    if (!set) return;
    for (const listener of set) {
      void Promise.resolve(listener(event)).catch((err) => {
        console.error('[config] listener failed', err);
      });
    }
  }

  listenerCount(scope: ConfigurationScopeLike): number {
    return this.listeners.get(String(scope))?.size ?? 0;
  }
}
