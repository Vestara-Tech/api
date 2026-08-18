# Vestara API — Agent Instructions

Standalone Vestara API v2 (Platform Gateway and Control Plane). pnpm workspace
(see `pnpm-workspace.yaml` and `packageManager` in `package.json`); Node >= 22.
All commands below are pnpm commands; run them from the repository root.

## Commands

```bash
pnpm dev                       # tsx watch src/main.ts (interactive only)

# Turborepo orchestrates the workspace (packages/* and vestara-apps/*):
pnpm build                     # turbo run build
pnpm typecheck                 # turbo run typecheck
pnpm lint                      # turbo run lint
pnpm test                      # turbo run test (workspace packages)
pnpm build:affected            # turbo run build --affected
pnpm test:affected             # turbo run test --affected

# The API root (this package) is not a turbo task target; run it directly:
pnpm build:api                 # tsc -p tsconfig.build.json
pnpm test:api                  # vitest run (full API suite)

# FASTVERIFY owns semantic verification for the API:
pnpm verify                    # incremental impact-based verification (default: affected)
pnpm verify:static             # V0 static checks (tsc -p tsconfig.json)
pnpm verify:affected           # V1 affected verification
pnpm verify:module -- <name>   # V2 module verification for a mapped module
pnpm verify:graph              # graph + ownership preflight (no builds/tests)
pnpm verify:platform           # V3 full suite (static + all tests)
pnpm verify:profile            # CP3A profiling (cold/warm, writes .vestara/evidence/verification/profiles/<sha>/...)
pnpm verify:telemetry          # aggregate verification performance telemetry
pnpm run test:one <files>      # one-shot vitest run of specific files

# Contract generation + drift checks:
pnpm openapi:generate          # regenerate contracts/openapi/vestara-api-v2.json
pnpm openapi:check             # fail if committed OpenAPI drifts from the app
pnpm contracts:frontend        # derive frontend wire contracts for vestara-apps/
pnpm contracts:frontend:check  # fail if frontend contracts drift
pnpm docs:sync / docs:check    # sync/check docs automation
```

Direct one-shot Vitest execution (pnpm passes `--` through to scripts, which
vitest does not accept before positional filters — use these forms):

```bash
pnpm exec vitest run tests/unit/onboarding-execution.test.ts
pnpm run test:one tests/unit/onboarding-execution.test.ts
```

Never pipe long-running verification through `tail`; it can hide progress and
make long-running/watch processes appear hung.

## Turbo Task Execution

This repository uses Turborepo for workspace task orchestration and
deterministic task caching.

Agents MUST use repository-level Turbo-backed commands where available
instead of manually executing the same task independently across packages.

Preferred:

    pnpm verify
    pnpm build
    pnpm test
    pnpm typecheck

For affected workspace operations:

    pnpm build:affected
    pnpm test:affected

Do not bypass Turbo merely to rerun deterministic work that already has
a valid cache entry.

A Turbo cache hit is acceptable for deterministic verification tasks
unless FASTVERIFY classifies the verification as environmental,
live, security-sensitive, or otherwise requiring fresh execution.

Do not use Turbo cache results as evidence for live system state,
external service availability, firmware state, network state, or other
environment-dependent verification.

The two engines have different responsibilities:

```text
FASTVERIFY  — "What actually needs verification?"
  file → module → contract → risk → verification level → evidence
Turborepo   — "What work can be skipped/reused?"
  package dependency graph → task scheduling → input hashing → local cache
```

Do not build a second task-output cache in FASTVERIFY; Turbo owns that.

## Repository Layout

- `src/<module>/` — API domain modules (auth, ai, onboarding, builder, ...)
- `src/core/`, `src/bootstrap/`, `src/config/` — API shared infrastructure
- `tests/unit|integration|contract/` — API Vitest suites (flat naming by module)
- `packages/*` — shared workspace packages (`@vestara/ai-ui`, `@vestara/ui`, `@vestara/client`)
- `vestara-apps/*` — Vite applications: `api-builder`, `os-image-builder`, `agent-builder`, `ai`, `admin`, `marketplace`, `workspace`
- `contracts/` — generated/checked API contracts (OpenAPI, frontend contracts)
- `turbo.json` — workspace task graph and cache configuration
- `scripts/verification/` — the FASTVERIFY engine (change detection, impact,
  fingerprinting, evidence cache, reports, telemetry)
- `.vestara/verification.json` — machine-readable verification policy + module map
- `docs/engineering/verification-policy.md` — canonical verification policy

## Verification Policy

All developer agents working in this repository MUST use incremental,
impact-based verification. The verification engine is executed with
`pnpm verify` and its scoped variants; it is the single source of truth for
what to run and when. Do not invent ad-hoc test commands.

### Core Rule

Run the smallest verification scope capable of invalidating the current
change. Do not repeatedly run the full repository test suite after individual
implementation tasks.

### Verification Control Plane Invariant

Agents do not determine sufficient verification. The Verification Control
Plane determines the required verification scope and evidence for a change.

### Verification Levels

- V0 — static: `tsc -p tsconfig.json` (typechecks src, tests, and scripts)
- V1 — affected: directly affected and transitively impacted tests
- V2 — module: the complete test scope for the affected module(s)
- V3 — platform: static + the full repository test suite

The engine selects V1 by default and escalates according to the policy
(contract changes, shared infrastructure, unknown impact, trigger files).

### Evidence and Cache

The engine fingerprints the exact verification scope (sources, tests,
dependencies, toolchain) and stores reusable PASS evidence under
`.vestara/evidence/verification/`. Valid cached evidence is reused instead of
rerunning tests.

- Do NOT rerun tests to produce your own verification claim when valid
  evidence exists for the same fingerprint.
- A failed result is evidence of failure, not a reusable PASS.
- `--no-cache` forces execution; it is not required after a reviewer/verifier
  request that changes nothing.

### Agent Completion Contract

Every implementation task must finish by running `pnpm verify` (or a scoped
variant) and reporting the evidence record it produces:

```text
Verification

Level:     V1 — affected
Impact:    onboarding
Selected:  4 tests
Executed:  4
Cached:    0
Result:    PASS
Duration:  2.8s
Evidence:  .vestara/evidence/verification/latest.json
Fingerprint: sha256:85e4d7...
```

A task must never claim broader verification than was actually performed, and
must never translate "no tests exist" into "verified". If the engine reports
`NO TESTS EXECUTED`, state that verification was static-only.

### Prohibited Patterns

Do NOT:

- run the full suite after every task "just to be safe";
- run watch mode (`vitest` without `run`);
- pipe long-running verification through `tail`;
- rerun passing tests without relevant changes;
- copy another agent's verification claim without checking the fingerprint.

See `docs/engineering/verification-policy.md` for the complete policy and
FASTVERIFY implementation details.
