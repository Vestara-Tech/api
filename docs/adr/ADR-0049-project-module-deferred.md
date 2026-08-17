# ADR-0049 — Defer a standalone Project Module until it owns real invariants

- Status: accepted
- Date: 2026-08-17
- Applies to: project-scoped APIs, projections, and any future Project module

## Context

Vestara already uses `project` as a shared scope and identifier in existing
platform areas:

- configuration precedence and resolution
- context collection and scoping
- template parameter resolution
- dashboard scope and projections
- route and query filtering in owning modules

There is currently no dedicated domain that owns project lifecycle,
membership, or project-specific invariants. Creating a standalone Project
module now would add another service boundary without solving an ownership
problem the repository actually has.

## Decision

> **Vestara will not introduce `src/project/**` or a public Project control
> plane API until project becomes a first-class aggregate with clear
> lifecycle and membership rules. Until then, `project` remains a scope and
> identifier consumed by the modules that already own the underlying data.**

### 1. Keep `project` as a cross-cutting scope

Existing modules may continue to use `project` in their own models and APIs:

- configuration may resolve values at `project` scope
- context may collect items at `project` scope
- templates may reference `projectName` and other project context
- dashboards may filter or aggregate by `project`

### 2. Do not create a Project module yet

Do not introduce:

- `src/project/**`
- `ProjectService`
- `ProjectRepository`
- `ProjectController`
- project-specific CRUD routes
- a dedicated project permission system

until the module owns meaningful invariants.

### 3. Introduce a Project module only when a trigger appears

A standalone module becomes justified when at least one of the following is
true:

- project needs canonical CRUD and identity management
- project needs lifecycle transitions such as archive, restore, or delete
- project needs membership, ownership, or role management
- project owns project-scoped settings or metadata with revision history
- project-specific permissions or approvals are required
- multiple modules need a single authoritative source of truth for `projectId`
- the UI needs a dedicated project list/detail surface that cannot be composed
  from existing module projections

### 4. Use a thin projection instead of a full module when possible

If the UI only needs to display or filter projects, prefer a read model or
projection over a new domain module.

Examples:

- dashboard widget filters by `projectId`
- configuration editor shows project scope provenance
- template picker shows project context

### 5. Keep identity stable

Use `projectId` as the immutable key.
Treat `projectName` as display data unless and until a dedicated Project module
owns canonical naming rules.

## Consequences

- The platform avoids a premature boundary that would mostly duplicate
  existing scope handling.
- Existing modules remain the source of truth for the data they already own.
- A future Project module can still be added later, but it will have explicit
  ownership and lifecycle rules instead of guessing at boundaries.
- Project-related UI can be built incrementally from existing projections and
  filtered queries.

## Routing rule

If a screen only filters, labels, or annotates data by project, keep the logic
in the owning module.

If a screen must manage the project itself, that is the point to introduce the
Project module.

## Deferred-now / introduce-later rule set

Defer the module when:

- project is only needed as a scope or foreign key
- existing modules can supply the data through projections or filters
- there is no membership or lifecycle to enforce
- there is no project-owned persistence with independent invariants

Introduce the module when:

- project becomes a platform aggregate rather than a label
- more than one module needs the same authoritative project registry
- project-specific permissions or approvals become unavoidable
- project lifecycle semantics begin to diverge from the owning modules

