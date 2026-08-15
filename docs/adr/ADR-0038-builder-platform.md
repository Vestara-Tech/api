# ADR-0038 — Page Builder & Application Builder (PAGE-001..013, APP-001..006)

- Status: accepted
- Date: 2026-08-15
- Applies to: PAGE-001 — PAGE-013, APP-001 — APP-006

## Context

Vestara had the Component Module (reusable primitives), API Builder, Builder
Plane and Generator Plane, but no declarative layer between components and
applications. Generated React was at risk of becoming the source of truth,
and page/application construction had no domain model.

## Decision

> **Components define reusable interface capabilities. Pages compose
> components and behavior. Applications compose pages and platform
> capabilities. Builders manipulate declarative definitions. Generators
> compile those definitions into executable artifacts. AI proposes changes
> to definitions; it does not bypass the builder model.**

### 1. PageDefinition (PAGE-001..004)

`PageDefinition` is the canonical declarative page object: route, layout,
nodes, data sources, actions, permissions, responsive rules, metadata and
revision. `PageNode` references the Component Module (never embeds
implementation); the layout model composes header/sidebar/content/footer.

### 2. Bindings (PAGE-006..009)

- `DataBinding` binds a node to API/Database/Context/Configuration/State/
  CurrentUser operations.
- `ActionBinding` (navigate/api.call/workflow.start/dialog.open/
  notification.send/state.set/form.submit/agent.invoke) keeps business logic
  out of components.
- `StateBinding` (page/application/session scope) and `PermissionBinding`
  (show/hide/disable) complete the model.

### 3. Validation + revisions + diff (PAGE-010/011/013)

`PageValidator` checks routes, component references against the Component
Module, action/event wiring and state keys — before any generation/preview.
Edits bump revisions; `diffPages` compares revisions structurally.

### 4. Page service + registry (PAGE-014/015/016)

`PageService` owns the declarative page registry and resolves components via
the Component Module. The Page Builder UI (PAGE-020) manipulates these
definitions, never generated code.

### 5. ApplicationDefinition (APP-001..006)

`ApplicationDefinition` is the canonical application object: pages, routes,
navigation, APIs, databases, authentication, permissions, workflows, agents,
configuration, integrations, state, lifecycle and revision. Applications
compose pages + platform capabilities. Direct database writes must be
governed. Lifecycle: draft -> planning -> building -> ready -> published.

### 6. Application service (APP-003)

`ApplicationBuilderService` resolves pages through the Page Builder,
validates routes/navigation/DB bindings, and enforces lifecycle transitions.

## Consequences

- Page Builder + Application Builder foundations complete as distinct builder
  domains above the Component Module.
- New control API: `/api/v2/pages` (CRUD + validate) and
  `/api/v2/applications` (CRUD + transition + model). OpenAPI regenerated and
  in sync. `page-builder` and `application-builder` capabilities registered.
- 14 new tests (11 unit + 3 integration). 642 total.
- PAGE-014..020 (API Builder/Database/Workflow/AI/Generator integration +
  visual editor) and APP-007..024 (API/db/auth/authorization bindings,
  templates, generator planning, build pipeline, Test/Browser verification,
  deployment, evidence, Marketplace packaging, AI generation, UI) follow.
