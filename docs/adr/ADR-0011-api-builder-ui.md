# ADR-0011 — API Builder UI and derived frontend contracts (API-UI-001..005)

- Status: accepted
- Date: 2026-08-15
- Applies to: API-UI-001 — API-UI-005

## Context

The API Definition Runtime needs a first-class visual development surface.
A literal Strapi clone would make "Content Types" the root abstraction; Vestara
exposes an **API Definition** containing Resources, Endpoints, Relations,
Policies, Operations, and Events. That supports CRUD APIs without constraining
Vestara to content-management workloads. The frontend must not invent a second
model of the API definition.

## Decision

### 1. `vestara-apps/` boundary

Frontend applications live under `vestara-apps/`, never in the backend `src/`
tree. `vestara-apps/api-builder/` is a self-contained React 19 + Vite +
TypeScript app (MUI for accessible primitives, Tailwind v4 for layout). It has
its own `package.json`/lockfile and must be installed with `--ignore-workspace`
because the repo root's `pnpm-workspace.yaml` otherwise treats the tree as a
workspace.

### 2. Derived wire contracts, single source of truth

The TypeBox schemas in `src/builder/contracts.ts` are the one source of truth.
`scripts/generate-frontend-contracts.ts` serializes them into
`vestara-apps/api-builder/src/api/contracts.ts`; `pnpm contracts:frontend`
regenerates and `contracts:frontend:check` gates drift in CI. The UI consumes
these derived types directly and never hand-models the definition.

### 3. API Definition is the root abstraction

Builder UI routes mirror the domain: create definition → add resource → define
fields/relations → configure generated endpoints → validate/preview →
publish/revisions. Endpoints are generated per resource (GET/POST/PATCH/
DELETE) and edited in a dedicated workbench. Relations are first-class visual
cards (kind, target, foreign key) on the resource canvas.

### 4. Interaction model: Navigator → Canvas → Inspector

The builder is a three-pane workspace, not a page tree. The context
(`BuilderContext`) owns the live definition and performs revision-safe
`If-Match: "revision-N"` PATCH updates so concurrent edits conflict rather than
silently overwrite.

### 5. Builder remains generated, not hand-written

Relation target validation is order-independent (fixed in the validator): a
relation may reference a resource declared later in the list. Publishing
remains gated on a valid, READY definition; the UI surfaces compatibility
classification and per-change severity before publish.

## Consequences

- A usable vertical slice: create → resources → fields → relations → endpoint
  workbench → validate → preview → publish → revisions, verified end-to-end
  against the live API by `pnpm test:ui` (chromium render tests).
- OpenAPI drift gates continue to protect the wire; the frontend contract gate
  protects the UI types.
- AI proposals, deeper compatibility analysis (API2-004), and publishing
  lifecycle visuals remain follow-up milestones (API-UI-006+).
