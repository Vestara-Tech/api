# ADR-0050 — AI-assisted theme generation through prompt-driven drafts

- Status: accepted
- Date: 2026-08-17
- Applies to: Theme Module, Theme Builder, AI-assisted theme authoring

## Context

Vestara already has a canonical Theme Module:

- themes are semantic, not raw CSS
- themes are hierarchical and independently replaceable
- adapters compile themes to MUI, CSS variables, and OS presentation
- validation and versioning are owned by the theme layer

The platform now needs a way to generate themes from plain-language prompts
without introducing a second theming system or bypassing validation.

The key requirement is:

> A user should be able to describe a theme in natural language and receive a
> structured theme draft that can be previewed, corrected, approved, and
> published.

## Decision

> **Vestara will support AI-assisted theme generation, but AI will only
> produce structured theme drafts and patch proposals. The Theme Module
> remains the source of truth for semantic tokens, validation, versioning,
> adapters, and publishing.**

### 1. Prompts generate proposals, not themes

Natural-language input is converted into a structured draft:

- `ThemeGenerationRequest`
- `ThemePromptProfile`
- `ThemeProposal`
- `ThemePatchProposal`
- `ThemeGenerationResult`

The AI may suggest:

- mode
- semantic tokens
- typography direction
- spacing density
- radius and elevation
- motion style
- component overrides
- assets and metadata

It must not emit raw CSS as the primary artifact.

### 2. Theme validation remains mandatory

Every generated draft must pass existing Theme Module validation plus
generation-specific checks:

- semantic token completeness
- color validity
- contrast and accessibility constraints
- light/dark/adaptive consistency
- OS adapter compatibility
- component override shape validity

Invalid output becomes a corrected draft or a rejected proposal, never a
published theme.

### 3. Publishing stays governed

AI is not allowed to publish themes directly.

The publish path is:

`Prompt → Proposal → Validation → Preview → Human Review → Versioned Theme → Registry → Distribution`

The Theme Registry remains authoritative. Theme versioning, rollback, and
provenance remain explicit.

### 4. Preview uses existing adapters

Theme previews should be derived from the same canonical theme definition and
compiled through existing adapters:

- MUI preview
- CSS variable preview
- OS presentation preview
- component sample preview

This ensures the prompt-driven draft is evaluated against the same semantics
the platform actually uses.

### 5. The Theme Builder is the user-facing entry point

Prompt generation belongs in a Theme Builder / Theme Authoring surface, not
inside the Theme Module as a hidden shortcut.

The builder should support:

- prompt entry
- generated candidate review
- token diffing
- inline correction
- accessibility warnings
- preview across surfaces
- draft save
- governed publish

### 6. The model is an assistant, not a registry

The AI layer may propose theme variants, but it must not:

- create a second theme registry
- bypass `validateTheme`
- write directly to generated artifacts
- bypass approval for publish

## Consequences

- Users can describe a theme in natural language and receive a usable draft.
- Vestara keeps one canonical theme model instead of fragmenting presentation
  semantics across AI, UI, and OS layers.
- Prompt-driven generation becomes reviewable and reversible.
- Theme packages can later be exported or distributed through Marketplace
  without changing the AI contract.
- Existing apps can consume generated themes incrementally through the same
  adapters they already use.

## Implementation sequence

1. Add AI-facing theme generation contracts to the Theme Module boundary.
2. Add a prompt-to-theme planner that converts text into semantic constraints.
3. Validate generated drafts with Theme Module rules and accessibility checks.
4. Add preview rendering using MUI, CSS, and OS adapters.
5. Build the Theme Builder / Theme Authoring UI.
6. Add governed publish, versioning, evidence, and rollback.
7. Add marketplace packaging only after generation and review are stable.

## Routing rule

If the work is about interpreting prompts into theme intent, it belongs to the
AI-assisted theme generation flow.

If the work is about defining, validating, adapting, or publishing the theme
itself, it belongs to the Theme Module.

