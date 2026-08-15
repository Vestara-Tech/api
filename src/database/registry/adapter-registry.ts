import { notFound } from '../../core/errors.js';
import type { DatabaseAdapter, DatabaseEngine } from '../contracts.js';

/** DB-003 — Adapter registry. Marketplace contributes adapters; core never hardcodes one. */
export class DatabaseAdapterRegistry {
  private readonly adapters = new Map<string, DatabaseAdapter>();

  register(adapter: DatabaseAdapter): void {
    this.adapters.set(adapter.engine, adapter);
  }

  resolve(engine: DatabaseEngine): DatabaseAdapter {
    const adapter = this.adapters.get(engine);
    if (!adapter) throw notFound(`No database adapter for engine "${engine}"`);
    return adapter;
  }

  list(): readonly DatabaseAdapter[] {
    return [...this.adapters.values()];
  }
}
