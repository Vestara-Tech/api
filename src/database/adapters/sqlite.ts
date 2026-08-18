import type {
  ColumnDefinition,
  DatabaseAdapter,
  DatabaseConnectionTest,
  DatabaseDataType,
  DatabaseQuery,
  DatabaseQueryResult,
  DatabaseSession,
  DatabaseSnapshot,
  ForeignKeyReference,
  MigrationPlan,
  ResolvedDatabaseConnection,
  TableDefinition,
} from '../contracts.js';

interface SqliteColumn extends ColumnDefinition {
  readonly primaryKey: boolean;
}

interface SqliteTableState {
  readonly name: string;
  columns: SqliteColumn[];
  rows: Record<string, unknown>[];
}

interface SqliteDatabaseState {
  readonly tables: Map<string, SqliteTableState>;
}

function normalizeIdentifier(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) return trimmed;
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ['`', '`'],
    ["'", "'"],
    ['[', ']'],
  ];
  for (const [start, end] of pairs) {
    if (trimmed.startsWith(start) && trimmed.endsWith(end)) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function splitTopLevel(input: string, separator = ','): string[] {
  const result: string[] = [];
  let current = '';
  let singleQuote = false;
  let doubleQuote = false;
  let bracketDepth = 0;
  let parenDepth = 0;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === "'" && !doubleQuote && bracketDepth === 0) {
      current += char;
      if (singleQuote && next === "'") {
        current += next;
        index += 1;
      } else {
        singleQuote = !singleQuote;
      }
      continue;
    }

    if (char === '"' && !singleQuote && bracketDepth === 0) {
      doubleQuote = !doubleQuote;
      current += char;
      continue;
    }

    if (!singleQuote && !doubleQuote) {
      if (char === '[') bracketDepth += 1;
      else if (char === ']' && bracketDepth > 0) bracketDepth -= 1;
      else if (char === '(') parenDepth += 1;
      else if (char === ')' && parenDepth > 0) parenDepth -= 1;
      else if (char === separator && bracketDepth === 0 && parenDepth === 0) {
        if (current.trim()) result.push(current.trim());
        current = '';
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) result.push(current.trim());
  return result;
}

function stripTrailingSemicolon(sql: string): string {
  return sql.trim().replace(/;+\s*$/, '');
}

function mapType(typeToken: string): DatabaseDataType {
  switch (typeToken.toLowerCase()) {
    case 'int':
    case 'integer':
    case 'smallint':
    case 'bigint':
      return 'integer';
    case 'decimal':
    case 'numeric':
    case 'real':
    case 'double':
    case 'float':
      return 'decimal';
    case 'bool':
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'date';
    case 'time':
      return 'time';
    case 'datetime':
    case 'timestamp':
      return 'datetime';
    case 'uuid':
      return 'uuid';
    case 'json':
      return 'json';
    case 'blob':
    case 'binary':
      return 'binary';
    case 'enum':
      return 'enum';
    case 'array':
      return 'array';
    case 'relation':
      return 'relation';
    case 'text':
    case 'varchar':
    case 'char':
    case 'string':
      return 'text';
    default:
      return 'custom';
  }
}

function parseLiteralToken(token: string, params: readonly unknown[], cursor: { index: number }): unknown {
  const trimmed = token.trim();
  if (trimmed === '?') {
    const value = params[cursor.index];
    cursor.index += 1;
    return value;
  }
  if (/^null$/i.test(trimmed)) return null;
  if (/^true$/i.test(trimmed)) return true;
  if (/^false$/i.test(trimmed)) return false;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    const body = trimmed.slice(1, -1);
    return trimmed.startsWith("'") ? body.replace(/''/g, "'") : body.replace(/\\"/g, '"');
  }
  return normalizeIdentifier(trimmed);
}

function parseColumnDefinition(definition: string): SqliteColumn {
  const trimmed = definition.trim();
  const tokens = trimmed.split(/\s+/);
  const name = normalizeIdentifier(tokens.shift() ?? '');
  const typeToken = tokens.shift() ?? 'text';
  const tail = tokens.join(' ').toLowerCase();
  const defaultMatch = trimmed.match(/\bdefault\b\s+(.+?)(?=\s+\b(?:not\s+null|primary\s+key|unique|references|generated)\b|$)/i);
  const referencesMatch = trimmed.match(/\breferences\b\s+([^\s(]+)\s*\(([^)]+)\)/i);
  const primaryKey = /\bprimary\s+key\b/i.test(tail);
  const nullable = !/\bnot\s+null\b/i.test(tail) && !primaryKey;
  const unique = /\bunique\b/i.test(tail) || primaryKey;
  const generated = /\bgenerated\b/i.test(tail);

  return {
    id: `c_${name}`,
    name,
    type: mapType(typeToken),
    nullable,
    unique,
    generated,
    ...(defaultMatch?.[1] ? { defaultValue: normalizeIdentifier(defaultMatch[1].trim()) } : {}),
    ...(referencesMatch?.[1] && referencesMatch?.[2]
      ? { references: { table: normalizeIdentifier(referencesMatch[1]), column: normalizeIdentifier(referencesMatch[2]) } satisfies ForeignKeyReference }
      : {}),
    primaryKey,
  };
}

function parseCreateTable(sql: string): { readonly name: string; readonly ifNotExists: boolean; readonly columns: SqliteColumn[] } | null {
  const match = sql.match(/^create\s+table\s+(if\s+not\s+exists\s+)?([^\s(]+)\s*\(([\s\S]+)\)$/i);
  if (!match) return null;
  const ifNotExists = Boolean(match[1]);
  const name = normalizeIdentifier(match[2]!);
  const body = match[3]!;
  const columns = splitTopLevel(body).filter(Boolean).map(parseColumnDefinition);
  return { name, ifNotExists, columns };
}

function parseInsert(sql: string): { readonly table: string; readonly columns: readonly string[] | null; readonly values: readonly string[][] } | null {
  const match = sql.match(/^insert\s+into\s+([^\s(]+)\s*(?:\(([^)]+)\))?\s+values\s+([\s\S]+)$/i);
  if (!match) return null;
  const table = normalizeIdentifier(match[1]!);
  const columns = match[2] ? splitTopLevel(match[2]!).map(normalizeIdentifier) : null;
  const valueGroups = splitTopLevel(match[3]!).map((group) => group.trim());
  const values: string[][] = [];

  for (const group of valueGroups) {
    const trimmed = group.trim();
    const body = trimmed.startsWith('(') && trimmed.endsWith(')') ? trimmed.slice(1, -1) : trimmed;
    values.push(splitTopLevel(body));
  }

  return { table, columns, values };
}

function parseSelect(sql: string): { readonly columns: readonly string[] | null; readonly table: string; readonly where?: { readonly column: string; readonly valueToken: string } } | null {
  const match = sql.match(/^select\s+([\s\S]+?)\s+from\s+([^\s;]+)(?:\s+where\s+([\s\S]+?))?$/i);
  if (!match) return null;
  const columns = match[1]!.trim() === '*'
    ? null
    : splitTopLevel(match[1]!).map((part) => {
      const aliasSplit = part.split(/\s+as\s+/i)[0];
      return normalizeIdentifier(aliasSplit ?? part);
    });
  const table = normalizeIdentifier(match[2]!);
  const whereClause = match[3]?.trim();
  if (!whereClause) return { columns, table };
  const whereMatch = whereClause.match(/^([^\s=]+)\s*=\s*([\s\S]+)$/);
  if (!whereMatch) return { columns, table };
  return {
    columns,
    table,
    where: {
      column: normalizeIdentifier(whereMatch[1]!),
      valueToken: whereMatch[2]!.trim(),
    },
  };
}

function parseAlterTable(sql: string): { readonly table: string; readonly column: SqliteColumn } | null {
  const match = sql.match(/^alter\s+table\s+([^\s]+)\s+add\s+column\s+([\s\S]+)$/i);
  if (!match) return null;
  return {
    table: normalizeIdentifier(match[1]!),
    column: parseColumnDefinition(match[2]!),
  };
}

function cloneColumn(column: SqliteColumn): ColumnDefinition {
  const { primaryKey: _primaryKey, ...rest } = column;
  return { ...rest };
}

function ensureTable(state: SqliteDatabaseState, tableName: string): SqliteTableState {
  const table = state.tables.get(tableName);
  if (!table) {
    throw new Error(`Table "${tableName}" not found`);
  }
  return table;
}

function applyCreateTable(state: SqliteDatabaseState, sql: string): void {
  const parsed = parseCreateTable(sql);
  if (!parsed) {
    throw new Error(`Unsupported CREATE TABLE statement: ${sql}`);
  }
  if (state.tables.has(parsed.name)) {
    if (parsed.ifNotExists) return;
    throw new Error(`Table "${parsed.name}" already exists`);
  }
  state.tables.set(parsed.name, {
    name: parsed.name,
    columns: parsed.columns,
    rows: [],
  });
}

function applyAlterTable(state: SqliteDatabaseState, sql: string): void {
  const parsed = parseAlterTable(sql);
  if (!parsed) {
    throw new Error(`Unsupported ALTER TABLE statement: ${sql}`);
  }
  const table = ensureTable(state, parsed.table);
  table.columns.push(parsed.column);
  for (const row of table.rows) {
    row[parsed.column.name] = undefined;
  }
}

function applyInsert(state: SqliteDatabaseState, sql: string): void {
  const parsed = parseInsert(sql);
  if (!parsed) {
    throw new Error(`Unsupported INSERT statement: ${sql}`);
  }
  const table = ensureTable(state, parsed.table);
  const cursor = { index: 0 };
  for (const valueGroup of parsed.values) {
    const rowValues = valueGroup.map((token) => parseLiteralToken(token, [], cursor));
    const row: Record<string, unknown> = {};
    const columns = parsed.columns ?? table.columns.map((column) => column.name);
    for (let index = 0; index < columns.length; index += 1) {
      row[columns[index]!] = rowValues[index];
    }
    table.rows.push(row);
  }
}

function applyDropTable(state: SqliteDatabaseState, sql: string): void {
  const match = sql.match(/^drop\s+table\s+(if\s+exists\s+)?([^\s;]+)$/i);
  if (!match) {
    throw new Error(`Unsupported DROP TABLE statement: ${sql}`);
  }
  state.tables.delete(normalizeIdentifier(match[2]!));
}

function applyMutation(state: SqliteDatabaseState, sql: string): void {
  const normalized = stripTrailingSemicolon(sql);
  if (/^create\s+table/i.test(normalized)) {
    applyCreateTable(state, normalized);
    return;
  }
  if (/^alter\s+table/i.test(normalized)) {
    applyAlterTable(state, normalized);
    return;
  }
  if (/^insert\s+into/i.test(normalized)) {
    applyInsert(state, normalized);
    return;
  }
  if (/^drop\s+table/i.test(normalized)) {
    applyDropTable(state, normalized);
    return;
  }
  if (/^select\s+/i.test(normalized)) {
    void executeSelect(state, normalized, []);
    return;
  }
  throw new Error(`Unsupported SQL statement: ${sql}`);
}

function executeSelect(state: SqliteDatabaseState, sql: string, params: readonly unknown[]): readonly Record<string, unknown>[] {
  const parsed = parseSelect(stripTrailingSemicolon(sql));
  if (!parsed) {
    throw new Error(`Unsupported SELECT statement: ${sql}`);
  }
  const table = ensureTable(state, parsed.table);
  const cursor = { index: 0 };
  let rows = [...table.rows];
  if (parsed.where) {
    const expected = parseLiteralToken(parsed.where.valueToken, params, cursor);
    rows = rows.filter((row) => row[parsed.where!.column] === expected);
  }
  const selectedColumns = parsed.columns;
  return rows.map((row) => {
    if (!selectedColumns) {
      return { ...row };
    }
    const projected: Record<string, unknown> = {};
    for (const column of selectedColumns) {
      projected[column] = row[column];
    }
    return projected;
  });
}

function tableSnapshot(table: SqliteTableState): TableDefinition {
  return {
    id: `t_${table.name}`,
    name: table.name,
    columns: table.columns.map((column) => cloneColumn(column)),
    ...(table.columns.some((column) => column.primaryKey)
      ? { primaryKey: table.columns.filter((column) => column.primaryKey).map((column) => column.name) }
      : {}),
  };
}

class InMemorySqliteSession implements DatabaseSession {
  readonly connectionId: string;
  private readonly state: SqliteDatabaseState;

  constructor(connectionId: string, state: SqliteDatabaseState) {
    this.connectionId = connectionId;
    this.state = state;
  }

  async close(): Promise<void> {
    return;
  }

  run(sql: string): void {
    applyMutation(this.state, sql);
  }

  query(sql: string, params: readonly unknown[] = []): readonly Record<string, unknown>[] {
    return executeSelect(this.state, sql, params);
  }
}

/**
 * DB-005 — SQLite-compatible reference adapter. Vestara keeps the contract
 * shape deterministic without a native runtime dependency.
 */
export class SqliteAdapter implements DatabaseAdapter {
  readonly id = 'sqlite';
  readonly engine = 'sqlite';
  private readonly states = new Map<string, SqliteDatabaseState>();

  private stateFor(connectionId: string): SqliteDatabaseState {
    let state = this.states.get(connectionId);
    if (!state) {
      state = { tables: new Map<string, SqliteTableState>() };
      this.states.set(connectionId, state);
    }
    return state;
  }

  async connect(connection: ResolvedDatabaseConnection): Promise<DatabaseSession> {
    return new InMemorySqliteSession(connection.id, this.stateFor(connection.id));
  }

  async testConnection(connection: ResolvedDatabaseConnection): Promise<DatabaseConnectionTest> {
    const started = Date.now();
    this.stateFor(connection.id);
    return { ok: true, latencyMs: Date.now() - started };
  }

  async introspect(session: DatabaseSession): Promise<DatabaseSnapshot> {
    const state = this.stateFor(session.connectionId);
    return {
      databaseId: session.connectionId,
      capturedAt: new Date().toISOString(),
      tables: [...state.tables.values()].map(tableSnapshot),
    };
  }

  async execute(session: DatabaseSession, query: DatabaseQuery): Promise<DatabaseQueryResult> {
    const started = Date.now();
    const state = this.stateFor(session.connectionId);
    const rows = executeSelect(state, query.statement, query.parameters ?? []);
    return { rows, rowCount: rows.length, durationMs: Date.now() - started };
  }

  async planMigration(current: DatabaseSnapshot, _target: never): Promise<MigrationPlan> {
    return { databaseId: current.databaseId, operations: [], destructive: false, risk: 'low', summary: 'no-op' };
  }

  async applyMigration(session: DatabaseSession, plan: MigrationPlan): Promise<{ ok: boolean; operations: number }> {
    const state = this.stateFor(session.connectionId);
    for (const operation of plan.operations) {
      switch (operation.kind) {
        case 'table.create':
          if (!state.tables.has(operation.table)) {
            state.tables.set(operation.table, { name: operation.table, columns: [], rows: [] });
          }
          break;
        case 'table.drop':
          state.tables.delete(operation.table);
          break;
        case 'column.add': {
          const table = state.tables.get(operation.table) ?? { name: operation.table, columns: [], rows: [] };
          if (!state.tables.has(operation.table)) {
            state.tables.set(operation.table, table);
          }
          if (!table.columns.some((column) => column.name === operation.column)) {
            table.columns.push({
              id: `c_${operation.column ?? 'column'}`,
              name: operation.column ?? 'column',
              type: 'custom',
              nullable: true,
              unique: false,
              generated: false,
              primaryKey: false,
            });
          }
          break;
        }
        case 'column.alter':
          break;
        case 'column.drop': {
          const table = state.tables.get(operation.table);
          if (table) {
            table.columns = table.columns.filter((column) => column.name !== operation.column);
            for (const row of table.rows) {
              delete row[operation.column ?? ''];
            }
          }
          break;
        }
        case 'index.create':
        case 'index.drop':
        case 'foreignKey.create':
        case 'foreignKey.drop':
        case 'data.transform':
        case 'custom.sql':
          if (operation.sql) {
            applyMutation(state, operation.sql);
          }
          break;
      }
    }
    return { ok: true, operations: plan.operations.length };
  }
}
