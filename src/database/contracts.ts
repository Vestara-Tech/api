/** DB-001/002 — Database contracts + canonical type system. */

export type DatabaseEngine = 'postgresql' | 'sqlite' | 'mysql' | 'mariadb' | 'cockroachdb' | 'mongodb';

/** Canonical Vestara data type system; adapters may extend. */
export type DatabaseDataType =
  | 'string' | 'text' | 'integer' | 'bigint' | 'decimal' | 'boolean'
  | 'date' | 'time' | 'datetime' | 'uuid' | 'json' | 'binary' | 'enum' | 'array' | 'relation' | 'custom';

export interface ForeignKeyReference {
  readonly table: string;
  readonly column: string;
  readonly onDelete?: 'cascade' | 'restrict' | 'set-null' | 'no-action';
}

export interface ColumnDefinition {
  readonly id: string;
  readonly name: string;
  readonly type: DatabaseDataType;
  readonly nullable: boolean;
  readonly unique: boolean;
  readonly generated: boolean;
  readonly defaultValue?: string;
  readonly references?: ForeignKeyReference;
  readonly enumValues?: readonly string[];
}

export interface TableDefinition {
  readonly id: string;
  readonly name: string;
  readonly schema?: string;
  readonly columns: readonly ColumnDefinition[];
  readonly primaryKey?: readonly string[];
  readonly indexes?: readonly { id: string; name: string; fields: readonly string[]; unique?: boolean }[];
  readonly foreignKeys?: readonly { id: string; name: string; column: string; references: ForeignKeyReference }[];
}

export interface DatabaseDefinition {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly engine: DatabaseEngine;
  readonly connectionId?: string;
  readonly tables: readonly TableDefinition[];
  readonly revision: number;
  readonly status: 'draft' | 'validating' | 'ready' | 'published' | 'invalid';
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DatabaseConnection {
  readonly id: string;
  readonly name: string;
  readonly engine: DatabaseEngine;
  readonly host: string;
  readonly port?: number;
  readonly database: string;
  readonly credentialRef: string;
  readonly ssl: boolean;
  readonly pool?: { readonly min: number; readonly max: number };
  readonly status: 'unknown' | 'connected' | 'error';
}

/** Resolved connection (never returned through the control API). */
export interface ResolvedDatabaseConnection {
  readonly id: string;
  readonly engine: DatabaseEngine;
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
  readonly ssl: boolean;
}

export interface DatabaseConnectionTest {
  readonly ok: boolean;
  readonly latencyMs: number;
  readonly error?: string;
}

/** DB-003 — adapter contract (the extensibility seam). */
export interface DatabaseSession {
  readonly connectionId: string;
  close(): Promise<void>;
}

export interface DatabaseSnapshot {
  readonly databaseId: string;
  readonly tables: readonly TableDefinition[];
  readonly capturedAt: string;
}

export interface DatabaseQuery {
  readonly statement: string;
  readonly parameters?: readonly unknown[];
  readonly readOnly?: boolean;
}

export interface DatabaseQueryResult {
  readonly rows: readonly Record<string, unknown>[];
  readonly rowCount: number;
  readonly durationMs: number;
}

export interface MigrationOperation {
  readonly kind: 'table.create' | 'table.drop' | 'column.add' | 'column.alter' | 'column.drop' | 'index.create' | 'index.drop' | 'foreignKey.create' | 'foreignKey.drop' | 'data.transform' | 'custom.sql';
  readonly table: string;
  readonly column?: string;
  readonly name?: string;
  readonly sql?: string;
}

export interface MigrationPlan {
  readonly databaseId: string;
  readonly operations: readonly MigrationOperation[];
  readonly destructive: boolean;
  readonly risk: 'low' | 'medium' | 'high' | 'critical';
  readonly summary: string;
}

export interface DatabaseAdapter {
  readonly id: string;
  readonly engine: DatabaseEngine;
  connect(connection: ResolvedDatabaseConnection): Promise<DatabaseSession>;
  testConnection(connection: ResolvedDatabaseConnection): Promise<DatabaseConnectionTest>;
  introspect(session: DatabaseSession): Promise<DatabaseSnapshot>;
  execute(session: DatabaseSession, query: DatabaseQuery): Promise<DatabaseQueryResult>;
  planMigration(current: DatabaseSnapshot, target: DatabaseDefinition): Promise<MigrationPlan>;
  applyMigration(session: DatabaseSession, plan: MigrationPlan): Promise<{ ok: boolean; operations: number }>;
}
