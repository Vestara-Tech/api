# ADR-0031 — Component Module (COMP-001..013)

- Status: accepted
- Date: 2026-08-15
- Applies to: COMP-001 — COMP-013

## Context

The Builder Plane (BLD-X) can compose and publish application surfaces, but
the actual building blocks — the components — had no platform-owned registry,
validation, composition model or lifecycle. Components come from Vestara Core,
installed modules, applications, Marketplace packages, workspace packages and
generated components.

## Decision

> **The Builder asks the Component Registry what exists rather than importing
> every component itself. Modules contribute component definitions; the
> Component Module owns registry, composition, validation, capability
> resolution, lifecycle and component trees.**

### 1. Component definition contract (COMP-001/002)

`ComponentDefinition` (id, packageId, category, renderer reference
react/web-component/custom, rich properties, slots, events, actions,
capabilities, permissions, design tokens) and `ComponentInstance`
(definition + properties + bindings + event bindings + slot composition +
visibility expression).

### 2. Registry (COMP-003)

Registry with versioned storage, resolution (latest or pinned), search,
categories with counts, versions, per-category listing. Built-in core
components (button, card, text, data-grid, agent-status, workflow-graph,
system-health) cover representative categories.

### 3. Component tree + validator (COMP-009/010)

`ComponentTree` (root instance + slots) and `ComponentTreeValidator`:
slot constraints (accepts by category or id, maxChildren), property schema
(enum values), and visibility expressions. Arbitrary drag/drop cannot
produce invalid UI trees.

### 4. Capability resolution (COMP-011)

`ComponentRegistry.availability(id)`: a component is available only when its
required capabilities (e.g. `database.read`, `agent.read`) are present. UI
can hide or degrade unavailable components instead of breaking.

### 5. Lifecycle and versioning (COMP-013)

`ComponentService`: published versions are immutable; edits always create a
new draft version. Owns component trees and tree validation.

### 6. Control API (COMP-021)

`/api/v2/components` (list/get/register), `/categories`, `/search`,
`/:id/versions`, `/:id/availability`, `/trees`, `/trees/:id/validate`.
`components` capability (`vestara.api.components`).

## Consequences

- Component registry, tree model, validator, capability resolution,
  lifecycle and control API are complete.
- 15 tests (10 unit + 5 integration). 545 total.
- COMP-014+ (drag/drop composition, bindings resolver, event/action wiring,
  generators, workspace sync, Marketplace marketplace contribution,
  Generator-generated components) follow.
