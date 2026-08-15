# ADR-0024 — Database Module (DB-001..007)

- Status: accepted
- Date: 2026-08-15
- Applies to: DB-001 — DB-007

## Context

PostgreSQL/Prisma are currently infrastructure hidden inside services. Vestara
needs both a **Database Platform** (governed connections) and a **Database
Builder** (visual schema/migration/API generation) that connects to API
Builder and the Generator Plane.

## Decision

> **Vestara owns database definitions, governance, capabilities and lifecycle.
> Drivers/ORMs provide implementations.**

### 1. Canonical type system

`DatabaseDataType` (string/text/integer/bigint/decimal/boolean/date/time/
datetime/uuid/json/binary/enum/array/relation/custom). PostgreSQL-specific
types are adapter extensions, never the platform-wide surface.

### 2. Connections are secret references

`DatabaseConnection.credentialRef` → `secret://database/production`. The
Database Module never returns resolved passwords through its control API.

### 3. Adapter contract + registry

`DatabaseAdapter` (connect/test/introspect/execute/planMigration/applyMigration)
is the extensibility seam; Marketplace contributes adapters (PostgreSQL,
MySQL, SQLite, Mongo). The **SQLite reference adapter** (node:sqlite) proves
the contract deterministically; PostgreSQL follows the same shape next.

### 4. Definition aggregate + diff + migration

`DatabaseDefinition` (schemas/tables/columns/indexes/foreignKeys/revision).
`SchemaDiffEngine` produces migration operations; `MigrationPlanner` analyzes
risk (column/table drops = high; custom.sql = critical). Migrations are
observable governed operations, not scattered raw SQL.

### 5. Governed lifecycle

Edit → draft → validate → diff → migration plan → risk analysis → preview →
approval → apply → verify → evidence. Destructive changes surface a critical
review (rows affected, dependencies, rollback) before apply.

## Consequences

- DB-001..007 foundation complete: contracts + canonical types, connection
  model with secret refs, adapter contract + registry, SQLite reference
  adapter, definition aggregate + store, schema diff, migration planner +
  risk analysis, control API (`/api/v2/database/*`), capability `database`.
- 11 tests (7 unit + 4 integration). 480 total.
- DB-008..022 (PostgreSQL adapter, introspection, query runtime, Permission/
  Generator/API-Builder/Diagnostics integration, Database Builder UI) follow.
