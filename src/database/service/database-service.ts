import { randomId } from '../../core/identifiers.js';
import type { DatabaseConnection, DatabaseDefinition, ResolvedDatabaseConnection } from '../contracts.js';
import { DatabaseAdapterRegistry } from '../registry/adapter-registry.js';
import { DatabaseStore } from '../store/database-store.js';
import { MigrationPlanner } from '../migration/planner.js';

export interface DatabaseServiceOptions {
  readonly store: DatabaseStore;
  readonly adapters: DatabaseAdapterRegistry;
}

/**
 * DB-014/015 — Database service. Vestara owns definitions, governance and
 * lifecycle; drivers/ORMs provide implementations. Passwords never leave the
 * secret store as raw values through the API.
 */
export class DatabaseService {
  private readonly store: DatabaseStore;
  private readonly adapters: DatabaseAdapterRegistry;
  private readonly planner = new MigrationPlanner();

  constructor(options: DatabaseServiceOptions) {
    this.store = options.store;
    this.adapters = options.adapters;
  }

  createDefinition(input: { id: string; name: string; engine: DatabaseDefinition['engine']; tables?: DatabaseDefinition['tables']; connectionId?: string }): DatabaseDefinition {
    const now = new Date().toISOString();
    return this.store.createDefinition({
      id: input.id,
      name: input.name,
      engine: input.engine,
      tables: input.tables ?? [],
      revision: 0,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      ...(input.connectionId !== undefined ? { connectionId: input.connectionId } : {}),
    });
  }

  getDefinition(id: string): DatabaseDefinition {
    return this.store.getDefinition(id);
  }

  listDefinitions(): readonly DatabaseDefinition[] {
    return this.store.listDefinitions();
  }

  planMigration(databaseId: string, target: DatabaseDefinition): { operations: readonly { kind: string; table: string; column?: string }[]; destructive: boolean; risk: string; summary: string } {
    const current = this.store.getDefinition(databaseId);
    const plan = this.planner.plan(current, target);
    return { operations: plan.operations, destructive: plan.destructive, risk: plan.risk, summary: plan.summary };
  }

  registerConnection(input: Omit<DatabaseConnection, 'status'>): DatabaseConnection {
    return this.store.registerConnection({ ...input, status: 'unknown' });
  }

  listConnections(): readonly DatabaseConnection[] {
    return this.store.listConnections();
  }

  /** Test a connection using its credential ref (passwords stay in the secret store). */
  async testConnection(connectionId: string, resolveCredential: (ref: string) => { user: string; password: string }): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const connection = this.store.getConnection(connectionId);
    const adapter = this.adapters.resolve(connection.engine);
    const credential = resolveCredential(connection.credentialRef);
    const resolved: ResolvedDatabaseConnection = {
      id: connection.id,
      engine: connection.engine,
      host: connection.host,
      port: connection.port ?? defaultPort(connection.engine),
      database: connection.database,
      user: credential.user,
      password: credential.password,
      ssl: connection.ssl,
    };
    const test = await adapter.testConnection(resolved);
    this.store.registerConnection({ ...connection, status: test.ok ? 'connected' : 'error' });
    return { ok: test.ok, latencyMs: test.latencyMs, ...(test.error !== undefined ? { error: test.error } : {}) };
  }

  async executeQuery(databaseId: string, statement: string, readOnly = true): Promise<{ rows: readonly Record<string, unknown>[]; rowCount: number }> {
    const definition = this.store.getDefinition(databaseId);
    if (!definition.connectionId) throw new Error(`Definition "${databaseId}" has no connection`);
    const adapter = this.adapters.resolve(definition.engine);
    const session = await adapter.connect(await resolveDirect(definition.connectionId, this.store, this.adapters));
    try {
      const result = await adapter.execute(session, { statement, readOnly });
      return { rows: result.rows, rowCount: result.rowCount };
    } finally {
      await session.close();
    }
  }
}

async function resolveDirect(
  connectionId: string,
  store: DatabaseStore,
  adapters: DatabaseAdapterRegistry,
): Promise<ResolvedDatabaseConnection> {
  const connection = store.getConnection(connectionId);
  const adapter = adapters.resolve(connection.engine);
  const resolved: ResolvedDatabaseConnection = {
    id: connection.id,
    engine: connection.engine,
    host: connection.host,
    port: connection.port ?? defaultPort(connection.engine),
    database: connection.database,
    user: 'vestara',
    password: '',
    ssl: connection.ssl,
  };
  void adapter;
  return resolved;
}

function defaultPort(engine: DatabaseDefinition['engine']): number {
  switch (engine) {
    case 'postgresql':
      return 5432;
    case 'mysql':
    case 'mariadb':
      return 3306;
    case 'mongodb':
      return 27017;
    default:
      return 0;
  }
}

export function definitionId(prefix = 'db'): string {
  return `${prefix}_${randomId(prefix).slice(prefix.length + 1)}`;
}
