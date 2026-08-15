import type { DatabaseDefinition, MigrationOperation, TableDefinition } from '../contracts.js';

/**
 * DB-011 — Schema diff engine. Compares a current snapshot's tables against a
 * target definition and produces migration operations.
 */
export class SchemaDiffEngine {
  diff(current: DatabaseDefinition, target: DatabaseDefinition): readonly MigrationOperation[] {
    const operations: MigrationOperation[] = [];
    const currentTables = new Map(current.tables.map((t) => [t.name, t]));
    const targetTables = new Map(target.tables.map((t) => [t.name, t]));

    for (const [name, targetTable] of targetTables) {
      const existing = currentTables.get(name);
      if (!existing) {
        operations.push({ kind: 'table.create', table: name });
        for (const column of targetTable.columns) {
          operations.push({ kind: 'column.add', table: name, column: column.name });
        }
        continue;
      }
      const existingColumns = new Set(existing.columns.map((c) => c.name));
      for (const column of targetTable.columns) {
        if (!existingColumns.has(column.name)) {
          operations.push({ kind: 'column.add', table: name, column: column.name });
        } else {
          operations.push({ kind: 'column.alter', table: name, column: column.name });
        }
      }
      for (const column of existing.columns) {
        if (!targetTable.columns.some((c) => c.name === column.name)) {
          operations.push({ kind: 'column.drop', table: name, column: column.name });
        }
      }
    }
    for (const [name] of currentTables) {
      if (!targetTables.has(name)) {
        operations.push({ kind: 'table.drop', table: name });
      }
    }
    return operations;
  }
}

/**
 * DB-012/013 — Migration planner + risk analyzer. Column drops and table drops
 * are destructive; custom.sql is always high risk.
 */
export class MigrationPlanner {
  plan(current: DatabaseDefinition, target: DatabaseDefinition): { operations: readonly MigrationOperation[]; destructive: boolean; risk: 'low' | 'medium' | 'high' | 'critical'; summary: string } {
    const operations = new SchemaDiffEngine().diff(current, target);
    const destructive = operations.some((op) => op.kind === 'column.drop' || op.kind === 'table.drop');
    const hasCustomSql = operations.some((op) => op.kind === 'custom.sql');
    const drops = operations.filter((op) => op.kind === 'column.drop' || op.kind === 'table.drop').length;
    let risk: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (hasCustomSql) risk = 'critical';
    else if (destructive && drops >= 2) risk = 'high';
    else if (destructive) risk = 'high';
    else if (operations.length > 0) risk = 'medium';
    return {
      operations,
      destructive,
      risk,
      summary: `${operations.length} operation(s), ${drops} destructive`,
    };
  }
}
