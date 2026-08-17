# Theme AI Generation Roadmap

Grounding: [ADR-0050 — AI-assisted theme generation through prompt-driven drafts](../adr/ADR-0050-ai-assisted-theme-generation.md)

Status: draft

## Goal

Add prompt-driven theme generation without creating a second theming system.
The Theme Module stays authoritative for:

- semantic tokens
- validation
- adapters
- versioning
- publish/rollback

AI only proposes structured drafts and patches.

## Current baseline

The repository already has:

- `src/theme/` with `ThemeDefinition`, `ThemeService`, adapters, OS contribution, and scope resolution
- `src/routes/theme.ts` exposing list/get/register/css/mui/os endpoints
- `src/bootstrap/theme.ts` registering built-in themes
- `vestara-apps/admin/src/pages/ThemesPage.tsx` as the first operational theme surface

That means the roadmap should extend the existing Theme Module and Admin UI,
not introduce a new theme registry or a separate builder app.

## Checkpoint 1 — AI-facing theme contracts

Target files:

- `src/theme/domain/theme-definition.ts`
- `src/theme/domain/theme-scope.ts`
- `src/theme/index.ts`
- `src/theme/service/theme-service.ts`
- `tests/unit/theme-module.test.ts`

Add:

- `ThemeGenerationRequest`
- `ThemePromptProfile`
- `ThemeProposal`
- `ThemePatchProposal`
- `ThemeGenerationResult`
- `ThemePreviewSpec`
- `ThemeEvidence`

Implementation rules:

- proposals are semantic, not CSS text
- proposals can be rejected or partially accepted
- generated output must still validate as a `ThemeDefinition`

Exit criteria:

- prompt/proposal types compile
- unit tests cover proposal shape and validation
- no route or UI behavior changes yet

## Checkpoint 2 — Prompt planner and AI orchestration

Target files:

- `src/theme/generation/theme-prompt-planner.ts`
- `src/theme/generation/theme-generation-service.ts`
- `src/theme/generation/theme-proposal-validator.ts`
- `src/ai/service/ai-service.ts`
- `src/ai/v2/profile.ts`
- `src/routes/theme.ts`
- `src/bootstrap/theme-capability.ts`
- `tests/unit/theme-generation.test.ts`
- `tests/integration/theme-api.test.ts`

Add API surface for:

- proposal creation from prompt
- draft validation
- prompt-to-theme planning
- capability registration for generation/proposal/publish operations

Implementation rules:

- AI may suggest theme intent and token structure
- AI does not publish themes
- AI does not bypass `validateTheme`
- prompt handling must use the existing AI service/routing stack

Exit criteria:

- a prompt returns a structured draft proposal
- invalid proposals are rejected with diagnostics
- capability metadata includes theme generation operations

## Checkpoint 3 — Preview, diff, and evidence

Target files:

- `src/theme/adapters/frontend.ts`
- `src/theme/contributions/os.ts`
- `src/routes/theme.ts`
- `src/theme/service/theme-service.ts`
- `tests/integration/theme-api.test.ts`

Add preview endpoints and helpers for:

- MUI preview output
- CSS variable preview output
- OS presentation preview
- token diffing against the active theme
- evidence metadata for generated drafts

Implementation rules:

- preview uses the same canonical `ThemeDefinition`
- preview output is derived, not stored as source of truth
- proposal evidence includes the prompt, model, and validation result

Exit criteria:

- generated themes can be previewed consistently across adapters
- preview responses are stable and test-covered
- evidence captures provenance for generated drafts

## Checkpoint 4 — Admin theme authoring surface

Target files:

- `vestara-apps/admin/src/pages/ThemesPage.tsx`
- `vestara-apps/admin/src/app/components/*`
- `vestara-apps/admin/src/app/hooks/useAdminApiClient.ts`
- `vestara-apps/admin/src/api/client.ts`
- `vestara-apps/admin/src/api/contracts.ts`
- `vestara-apps/admin/tests/navigation.test.ts`

Add UI for:

- prompt input
- generated proposal list
- token editor
- token diff
- validation warnings
- adapter previews
- draft save
- publish request

Implementation rules:

- Admin is the first reference consumer of AI-assisted themes
- the UI uses `@vestara/ui` primitives
- the UI never writes theme artifacts directly
- publish goes through the governed backend flow

Exit criteria:

- Admin can generate a theme draft from a prompt
- Admin can review and edit the draft
- Admin can preview before publish
- theme navigation remains capability-aware

## Checkpoint 5 — Governed publish, versioning, rollback

Target files:

- `src/theme/service/theme-service.ts`
- `src/theme/registry/theme-registry.ts`
- `src/routes/theme.ts`
- `src/bootstrap/theme.ts`
- `contracts/openapi/vestara-api-v2.json`
- `tests/unit/theme-module.test.ts`
- `tests/integration/theme-api.test.ts`

Add:

- draft lifecycle
- versioned publish
- rollback support
- provenance retention
- rejection/approval history

Implementation rules:

- the registry remains authoritative
- AI cannot publish directly
- every publish is versioned and auditable

Exit criteria:

- published themes are versioned
- rollback is supported
- OpenAPI stays in sync
- publish/rollback tests pass

## Checkpoint 6 — Packaging and rollout

Target files:

- `src/marketplace/**`
- `src/template/**`
- `vestara-apps/admin/src/pages/ThemesPage.tsx`
- `vestara-apps/workspace/**` if a future authoring shell is justified

Add:

- theme export/import packaging
- marketplace distribution for themes
- migration of existing apps to generated themes
- incremental replacement of hardcoded theme assumptions

Implementation rules:

- ship incrementally
- keep built-in themes as fallback
- migrate Admin first, then other apps

Exit criteria:

- themes can be distributed as packages
- at least one app consumes a generated theme end-to-end
- no app depends on a separate theme system

## Verification rule

Each checkpoint must end with:

- implementation complete
- typecheck complete
- targeted tests complete
- `pnpm verify:affected`
- evidence recorded

Do not mark the roadmap complete until the generated theme flow is usable in
Admin and publish is governed end-to-end.

