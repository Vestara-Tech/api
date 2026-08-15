# ADR-0041 — Theme Module (THEME-001..014)

- Status: accepted
- Date: 2026-08-15
- Applies to: THEME-001 — THEME-014

## Context

Vestara needed a presentation layer that was not tied to any one frontend
library (MUI/Tailwind/CSS) and could also reach OS presentation (GRUB,
Plymouth, login, desktop). The recommendation established:

```
Theme = how something looks
Template = what something starts as
Component = reusable UI building block
Builder = edits definitions
Generator = produces artifacts
Runtime = renders/executes result
```

## Decision

> **A theme is not a bag of CSS variables; it describes Vestara's
> presentation semantics via semantic tokens. Adapters compile it to
> MUI/Tailwind/CSS/OS. Themes are hierarchical and independently
> replaceable.**

### 1. ThemeDefinition (THEME-001..005)

`ThemeDefinition`: mode (light/dark/adaptive), semantic tokens
(`color.background.*`, `color.text.*`, `color.border.*`, `color.brand.*`,
`color.status.*`), typography, spacing, radius, elevation, motion, component
overrides, assets, metadata. Semantic tokens stay frontend-library-independent.

### 2. Scope resolution (THEME-006)

`ThemeScopeResolver` resolves hierarchical themes with deterministic
precedence: system < organization < workspace < application < page <
component. A component-level override wins; one application can use a
different theme without changing the entire Vestara desktop.

### 3. Registry + validation + revisions (THEME-007/008/009)

`ThemeRegistry` holds first-party + Marketplace-installed themes.
`validateTheme` checks identity, typography, spacing and hex-color tokens.
Revisions bump version.

### 4. Adapters (THEME-010/011)

`toMuiTheme` compiles tokens into a MUI Theme object; `toCssRules` compiles
them into `--vestara-*` CSS custom properties (Tailwind/CSS). Only the
adapters know the frontend library.

### 5. OS theme contribution (THEME-014)

`osThemeContribution` maps a Vestara theme to GRUB, Plymouth, login, desktop
shell and notification appearance. Firmware branding stays separate (different
risk boundary).

## Consequences

- Theme Module foundation complete: definition, semantic tokens, scope
  resolver, registry, validation, revisions, MUI/CSS adapters, OS
  contribution. `themes` capability registered.
- New control API: `/api/v2/themes` (list/get/register + css/mui/os
  adapters). OpenAPI regenerated and in sync.
- 13 new tests (10 unit + 3 integration). 696 total.
- THEME-012..020 (Component/Dashboard/Page/App integration, Theme Builder,
  AI generation, Generator contribution, Marketplace packaging, import/export,
  evidence) follow.
