# ADR-0040 — Dashboard Module + Builder + Generator (DASH-001..020, DASH-BLD, DASH-GEN)

- Status: accepted
- Date: 2026-08-15
- Applies to: DASH-001 — DASH-020, DASH-BLD-001..012, DASH-GEN-001..006

## Context

Vestara had many modules owning domain state but no composition/read-model
plane for the home screen. The recommendation established the core rule:

> Dashboard owns presentation, composition, layout and projections. Source
> modules continue to own their domain state and operations.

Dashboard must never directly manipulate every module's internal store.

## Decision

> **Dashboard owns presentation/composition/layout/projections. Modules
> contribute widgets + projections through a contribution contract; the
> registry + module lifecycle make widgets appear/disappear automatically.
> Dashboard never hard-codes module knowledge.**

### 1. Definitions (DASH-001..006)

`DashboardDefinition` (scope, layout grid, widgets, filters, refresh policy,
owner, revision), `DashboardWidgetDefinition` (contributed by modules with
sizes/default size/data source/permissions/configurable), `WidgetInstance`
(placement + configuration + load state), `DashboardDataSource` (module/
api/projection/static/context), and `DashboardProjectionDefinition`.

### 2. Contribution contract + registry (DASH-007/008)

`DashboardContribution` (moduleId + widgets + projections). Installed modules
register contributions; disabling a module makes its widgets unavailable via
the module-lifecycle port. First-party contributions: system, task, agent,
workflow, diagnostics, database, notification.

### 3. Store + service (DASH-009/010)

`DashboardStorePort`/`DashboardService` own dashboards: create/update/get/
list/remove, widget management, filters, refresh policies, clone/reset.
Validation enforces permissions (DASH-011), revision bumps (DASH-020),
publish freezes a revision.

### 4. Projection aggregation (DASH-015/016/017)

`ProjectionService` aggregates projections concurrently, each provider
isolated with its own timeout. A broken module degrades to a per-widget
error state — never a dashboard HTTP 500. Cache/staleness serves last-good
data when a provider fails.

### 5. Validation (DASH-019)

`DashboardValidator` checks widget types resolve in the registry (module
lifecycle honored), grid placements stay in-bounds, and required permissions
are present.

### 6. Builder (DASH-BLD)

`DashboardBuilderSession` owns a working `DashboardDraft` (canvas grid,
add/remove/move/configure widgets). `DashboardBuilderService.publish`
validates then saves the definition into the registry. Save-as-template
captures a definition snapshot. Builder edits definitions; runtime renders
published definitions.

### 7. Generator (DASH-GEN)

`DashboardGenerator` plans from available modules/widgets (no hard-coded
knowledge), composes a `DashboardGenerationPlan`, and produces a normal
`DashboardDefinition`. Templates still produce DashboardDefinition objects —
templates are not a second format. `fromTemplate` clones a template into a
new definition.

## Consequences

- Dashboard Module + Builder + Generator foundations complete.
- New control API: `/api/v2/dashboards` (CRUD + clone/reset/validate/publish/
  widgets + per-dashboard projection), `/api/v2/dashboard/widgets`,
  `/api/v2/dashboard/projections/:projection`, `/api/v2/dashboard/generate`,
  `/api/v2/dashboard/builder/open|publish`. `dashboard` capability.
  OpenAPI regenerated and in sync.
- 25 new tests (21 unit + 4 integration). 683 total.
- DASH-012..018 (user prefs, config integration, realtime events),
  DASH-027..030 (Dashboard UI + Builder UI + AI/Generator integration +
  evidence) follow.
