import { DatabaseAdapterRegistry } from '../database/registry/adapter-registry.js';
import { DatabaseStore } from '../database/store/database-store.js';
import { DatabaseService } from '../database/service/database-service.js';
import { SqliteAdapter } from '../database/adapters/sqlite.js';

export interface DatabasePlatform {
  readonly store: DatabaseStore;
  readonly adapters: DatabaseAdapterRegistry;
  readonly service: DatabaseService;
}

/** DB — Composition root. Registers the SQLite reference adapter. */
export function buildDatabasePlatform(): DatabasePlatform {
  const store = new DatabaseStore();
  const adapters = new DatabaseAdapterRegistry();
  adapters.register(new SqliteAdapter());
  const service = new DatabaseService({ store, adapters });
  return { store, adapters, service };
}
