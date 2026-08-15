# ADR-0042 — Template Module (TPL-001..018)

- Status: accepted
- Date: 2026-08-15
- Applies to: TPL-001 — TPL-018

## Context

Vestara needed structural starting points across every kind of artifact
(application, page, dashboard, component, api, database, workflow, agent,
os-image, configuration). Separate per-kind template engines would have
duplicated the contribution/registry/service pattern. The recommendation
established:

```
Theme = how something looks
Template = what something starts as
```

## Decision

> **One Template Module owns templates of every kind. Modules contribute
> templates through a contribution contract; templates are structural
> starting points with validated parameters and constrained variable
> resolution — never an arbitrary code-execution language.**

### 1. TemplateDefinition (TPL-001..003)

Generic `TemplateDefinition<TDefinition>`: id, name, version, kind (12 kinds),
parameters with typed schemas (string/number/boolean/enum/theme-reference/
workspace-reference), definition payload, recommendedThemeId, required
capabilities, metadata. No per-kind engines.

### 2. Constrained variable resolution (TPL-004)

`{{parameters.x}}` and `{{context.projectName|workspaceId|userId|userName}}`
only. Unknown placeholders pass through; `{{process.exit(0)}}` is not
evaluated. Templates are not a code-execution language.

### 3. Registry + contributions (TPL-005/006)

One `TemplateRegistry` for all kinds. `TemplateContribution` lets modules
(Agent, Dashboard, API Builder, OS) register templates without modifying
Template core.

### 4. Validation + revisions (TPL-007/008)

`validateTemplate` checks identity/version/duplicate parameters;
`validateParameterValues` enforces required/enum/number; defaults merge in
(parameter.defaultValue). Versions bump for revisions.

### 5. Instantiation (TPL-004/008)

`TemplateService.instantiate` validates values, merges defaults, deep-resolves
strings in the definition against the parameter + context, and returns the
typed result. Templates produce real definitions — templates are not a second
format.

### 6. First-party templates (TPL-013..018)

Built-in: engineering dashboard, operations dashboard, CRUD page, admin
platform application, coding agent, desktop OS image. Each recommends a theme
(Theme Module) which remains independently replaceable.

## Consequences

- Template Module foundation complete: generic definition, parameter schema,
  constrained resolution, registry, contribution contract, validation,
  revisions, theme association, first-party templates across kinds.
- New control API: `/api/v2/templates` (list/kinds/get/register/instantiate/
  remove). `templates` capability registered. OpenAPI regenerated and in sync.
- 17 new tests (13 unit + 4 integration). 713 total.
- TPL-009..023 (capability requirements, Builder integration, Generator
  integration, AI template generation, Marketplace packaging, import/export,
  Template Builder, evidence) follow.
