import { DatabaseAdapterRegistry } from '../database/registry/adapter-registry.js';
import { DatabaseStore } from '../database/store/database-store.js';
import { DatabaseService } from '../database/service/database-service.js';

export interface DatabasePlatform {
  readonly store: DatabaseStore;
  readonly adapters: DatabaseAdapterRegistry;
  readonly service: DatabaseService;
}

/** DB — Composition root. Builds the database service shell. */
export function buildDatabasePlatform(): DatabasePlatform {
  const store = new DatabaseStore();
  const adapters = new DatabaseAdapterRegistry();
  const service = new DatabaseService({ store, adapters });
  return { store, adapters, service };
}
