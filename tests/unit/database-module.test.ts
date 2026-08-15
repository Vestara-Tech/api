import { describe, expect, it } from 'vitest';
import { DatabaseService, DatabaseStore, DatabaseAdapterRegistry, MigrationPlanner, SchemaDiffEngine, SqliteAdapter, type DatabaseDefinition } from '../../src/database/index.js';

function def(id: string, tables: DatabaseDefinition['tables']): DatabaseDefinition {
  return { id, name: id, engine: 'sqlite', tables, revision: 0, status: 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

describe('DB-011 schema diff engine', () => {
  it('detects table/column adds, alters and drops', () => {
    const current = def('db', [
      { id: 't1', name: 'users', columns: [{ id: 'c1', name: 'id', type: 'integer', nullable: false, unique: true, generated: false }] },
    ]);
    const target = def('db', [
      {
        id: 't1', name: 'users',
        columns: [
          { id: 'c1', name: 'id', type: 'integer', nullable: false, unique: true, generated: false },
          { id: 'c2', name: 'email', type: 'string', nullable: false, unique: true, generated: false },
        ],
      },
      { id: 't2', name: 'posts', columns: [{ id: 'c1', name: 'id', type: 'integer', nullable: false, unique: true, generated: false }] },
    ]);
    const operations = new SchemaDiffEngine().diff(current, target);
    const kinds = operations.map((o) => o.kind);
    expect(kinds).toContain('column.add');
    expect(kinds).toContain('table.create');
    expect(kinds).not.toContain('table.drop');
  });

  it('marks dropped columns', () => {
    const current = def('db', [
      { id: 't1', name: 'users', columns: [
        { id: 'c1', name: 'id', type: 'integer', nullable: false, unique: true, generated: false },
        { id: 'c2', name: 'secret', type: 'text', nullable: true, unique: false, generated: false },
      ] },
    ]);
    const target = def('db', [
      { id: 't1', name: 'users', columns: [{ id: 'c1', name: 'id', type: 'integer', nullable: false, unique: true, generated: false }] },
    ]);
    const operations = new SchemaDiffEngine().diff(current, target);
    expect(operations.some((o) => o.kind === 'column.drop' && o.column === 'secret')).toBe(true);
  });
});

describe('DB-012/013 migration planner + risk', () => {
  it('classifies destructive changes as high risk', () => {
    const current = def('db', [
      { id: 't1', name: 'users', columns: [{ id: 'c1', name: 'email', type: 'string', nullable: false, unique: true, generated: false }] },
    ]);
    const target = def('db', [
      { id: 't1', name: 'users', columns: [{ id: 'c1', name: 'name', type: 'string', nullable: false, unique: false, generated: false }] },
    ]);
    const plan = new MigrationPlanner().plan(current, target);
    expect(plan.destructive).toBe(true);
    expect(plan.risk).toBe('high');
    expect(plan.summary).toContain('destructive');
  });

  it('classifies additive changes as medium risk', () => {
    const current = def('db', []);
    const target = def('db', [
      { id: 't1', name: 'users', columns: [{ id: 'c1', name: 'id', type: 'integer', nullable: false, unique: true, generated: false }] },
    ]);
    const plan = new MigrationPlanner().plan(current, target);
    expect(plan.destructive).toBe(false);
    expect(plan.risk).toBe('medium');
  });
});

describe('DB-003 adapter registry', () => {
  it('registers and resolves the SQLite adapter', () => {
    const registry = new DatabaseAdapterRegistry();
    registry.register(new SqliteAdapter());
    expect(registry.resolve('sqlite').id).toBe('sqlite');
    expect(registry.list()).toHaveLength(1);
  });
});

describe('DB-005 SQLite adapter', () => {
  it('tests, executes queries and introspects', async () => {
    const adapter = new SqliteAdapter();
    const resolved = { id: 'conn', engine: 'sqlite' as const, host: 'local', port: 0, database: ':memory:', user: 'x', password: '', ssl: false };
    const test = await adapter.testConnection(resolved);
    expect(test.ok).toBe(true);

    const session = await adapter.connect(resolved);
    const s = session as { run(sql: string): void };
    s.run('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
    s.run("INSERT INTO users (name) VALUES ('vestara')");

    const result = await adapter.execute(session, { statement: 'SELECT name FROM users' });
    expect(result.rowCount).toBe(1);

    const snapshot = await adapter.introspect(session);
    expect(snapshot.tables.map((t) => t.name)).toContain('users');
    await session.close();
  });
});

describe('DB service definitions', () => {
  it('creates, plans and lists definitions', () => {
    const store = new DatabaseStore();
    const adapters = new DatabaseAdapterRegistry();
    adapters.register(new SqliteAdapter());
    const service = new DatabaseService({ store, adapters });
    const current = service.createDefinition({ id: 'shop', name: 'Shop', engine: 'sqlite' });
    expect(current.status).toBe('draft');
    expect(service.getDefinition('shop').id).toBe('shop');
    expect(service.listDefinitions()).toHaveLength(1);

    const target = service.createDefinition({ id: 'shop2', name: 'Shop2', engine: 'sqlite', tables: [{ id: 't', name: 'products', columns: [{ id: 'c', name: 'id', type: 'integer', nullable: false, unique: true, generated: false }] }] });
    const plan = service.planMigration('shop', target);
    expect(plan.operations.length).toBeGreaterThan(0);
  });
});
