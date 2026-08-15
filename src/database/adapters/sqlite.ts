import { DatabaseSync } from 'node:sqlite';
import type { DatabaseAdapter, DatabaseConnectionTest, DatabaseQuery, DatabaseQueryResult, DatabaseSession, DatabaseSnapshot, MigrationPlan, ResolvedDatabaseConnection } from '../contracts.js';

class SqliteSession implements DatabaseSession {
  readonly connectionId: string;
  private readonly db: DatabaseSync;
  constructor(connectionId: string, db: DatabaseSync) {
    this.connectionId = connectionId;
    this.db = db;
  }
  async close(): Promise<void> {
    this.db.close();
  }
  run(sql: string): void {
    this.db.exec(sql);
  }
  query(sql: string, params: readonly unknown[] = []): readonly Record<string, unknown>[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...(params as Parameters<typeof stmt.all>)) as readonly Record<string, unknown>[];
  }
}

/**
 * DB-005 — SQLite reference adapter (node:sqlite, no external driver). Proves
 * the adapter contract deterministically; PostgreSQL follows the same shape.
 */
export class SqliteAdapter implements DatabaseAdapter {
  readonly id = 'sqlite';
  readonly engine = 'sqlite';

  async connect(connection: ResolvedDatabaseConnection): Promise<DatabaseSession> {
    const db = new DatabaseSync(connection.database === ':memory:' ? ':memory:' : connection.database);
    return new SqliteSession(connection.id, db);
  }

  async testConnection(connection: ResolvedDatabaseConnection): Promise<DatabaseConnectionTest> {
    const started = Date.now();
    try {
      const db = new DatabaseSync(connection.database === ':memory:' ? ':memory:' : connection.database);
      db.exec('SELECT 1');
      db.close();
      return { ok: true, latencyMs: Date.now() - started };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - started, error: (err as Error).message };
    }
  }

  async introspect(session: DatabaseSession): Promise<DatabaseSnapshot> {
    const s = session as SqliteSession;
    const tables = s.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    return {
      databaseId: session.connectionId,
      capturedAt: new Date().toISOString(),
      tables: tables.map((t) => ({ id: `t_${t.name}`, name: String(t.name), columns: [] })),
    };
  }

  async execute(session: DatabaseSession, query: DatabaseQuery): Promise<DatabaseQueryResult> {
    const s = session as SqliteSession;
    const started = Date.now();
    const rows = s.query(query.statement, query.parameters ?? []);
    return { rows, rowCount: rows.length, durationMs: Date.now() - started };
  }

  async planMigration(current: DatabaseSnapshot, _target: never): Promise<MigrationPlan> {
    return { databaseId: current.databaseId, operations: [], destructive: false, risk: 'low', summary: 'no-op' };
  }

  async applyMigration(session: DatabaseSession, plan: MigrationPlan): Promise<{ ok: boolean; operations: number }> {
    const s = session as SqliteSession;
    for (const operation of plan.operations) {
      if (operation.sql) s.run(operation.sql);
    }
    return { ok: true, operations: plan.operations.length };
  }
}
