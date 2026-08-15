# ADR-0043 — Builder Plane v2 (BuilderSession / DefinitionDraft)

- Status: accepted
- Date: 2026-08-15
- Applies to: BLD-X v2

## Context

Each builder (Agent, API, Page, Application, Dashboard, Theme, Template) was
evolving its own edit/validate/publish flow. The recommendation: make Agent
Builder and API Builder reference implementations of a **shared Builder Plane
contract** so all builders behave consistently instead of becoming separate
mini-products.

## Decision

> **Every builder exposes the same lifecycle: create -> configure -> validate
> -> preview -> test -> publish -> version -> clone -> export. Builders edit
> drafts (BuilderSession/DefinitionDraft); generators produce artifacts from
> definitions; the runtime renders published definitions.**

### 1. BuilderSession (BLD-X v2)

`BuilderSession<TKind, TSpec>` owns a working draft with status
editing/validated/previewing/testing/published/discarded. Methods: configure
(patch spec), validate, preview, test, publish (freezes revision), clone
(new id, revision 0, draft), export (the canonical artifact for the
generator). One shared lifecycle across every builder.

### 2. BuilderPlane (BLD-X v2)

`BuilderPlane` routes sessions through the shared lifecycle: opens sessions
(blank or from a base definition), validates drafts against the contribution
validator, publishes into the shared `BuilderStore` + `BuilderLifecycle`,
lists drafts and active sessions.

### 3. Control API

`/api/v2/builders/sessions` (open/config/validate/publish/list/discard),
extending the existing `/api/v2/builders/definitions` plane.

## Consequences

- Builder Plane v2 contract complete: one shared lifecycle for all builders.
- New control API sessions endpoints. OpenAPI regenerated and in sync.
- 5 new tests (4 unit + 1 integration). 718 total.
- Agent/API/Page/Application/Dashboard/Theme/Template builders can now
  implement the same session contract; Dashboard Builder + AI + Templates
  operate across builders consistently.
