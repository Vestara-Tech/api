# ADR-0048 — Admin-first shared UI strategy; no new backend Workspace module

- Status: accepted
- Date: 2026-08-17
- Applies to: UI-FOUNDATION-001

## Context

Vestara already uses the word “workspace” in several places:

- file workspaces and sandboxing
- configuration and theme scope inheritance
- OS image application catalogs
- builder-style and authoring-style UI surfaces

That does not imply a missing backend `workspace` domain module.

The repository also does not currently contain a unified frontend Workspace
shell. The existing frontend apps are independent Vite applications with
local layouts and duplicated theme patterns. The architectural need is a
shared frontend foundation, not a new backend abstraction whose semantics
already exist in other domains.

The platform needs a first reference consumer for `@vestara/ui`. Admin is the
best fit because it exercises the control-plane surface that already exists:

- system and OS operations
- diagnostics and logs
- configuration and provenance
- permissions and governed actions
- agent operations
- dashboard and health surfaces

## Decision

> **Vestara will not introduce a new backend Workspace module at this time.
> `Admin` is the first reference consumer of `@vestara/ui`. A future
> Workspace application may be introduced later as a product shell for
> authoring and composition workflows, but only if those workflows become
> clearly distinct and reusable.**

### 1. No new backend Workspace module

Do not create `src/workspace/**` or a new backend module solely to justify
shared UI extraction.

Existing “workspace” concepts remain where they already live:

- file workspace APIs in the File module
- workspace scope in configuration, themes, and templates
- OS image `@vestara/app-workspace` catalog entries

### 2. Admin is the first reference consumer

`@vestara/ui` is validated first by `vestara-apps/admin`.

Admin owns the control-plane use case:

- observing platform state
- rendering operational dashboards
- surfacing governed actions
- enforcing capability-aware navigation

### 3. Workspace is a future product shell, not a prerequisite

A future `Workspace` app is allowed if and when the product has repeated
authoring patterns that are clearly different from Admin’s operational
patterns.

Workspace should be treated as:

- authoring / composition
- multi-pane editing
- preview / compare / draft workflows

not as a mandatory prerequisite for shared UI validation.

### 4. Shared UI remains frontend-only

`@vestara/ui` is the shared rendering layer:

- theme provider
- shell primitives
- navigation primitives
- operational feedback primitives

It must not acquire application business logic or backend domain behavior.

## Consequences

- The roadmap no longer depends on a nonexistent Workspace shell.
- Admin becomes the first meaningful proof that `@vestara/ui` is viable.
- UI design can be validated against real operational use cases instead of a
  speculative shell abstraction.
- A future Workspace app remains available, but only as a justified product
  decision rather than a forced architectural prerequisite.
- The repository avoids duplicating the existing “workspace” concept as a new
  backend domain.

## Routing rule

Use Admin when the screen is about operating Vestara.

Use Workspace only when the screen is about composing or authoring artifacts.

If a screen does both, default to Admin and extract a Workspace later only if
the authoring flow becomes reusable and distinct.

## Practical examples

Admin:

- health
- diagnostics
- logs
- evidence
- permissions
- configuration
- system / OS
- agent operations

Workspace:

- component builder
- generator preview
- template editor
- dashboard authoring
- page composition
- layout editing
- multi-pane inspector workflows

