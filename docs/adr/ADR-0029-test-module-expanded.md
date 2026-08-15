# ADR-0029 — Expanded Test Module (TEST-001..023)

- Status: accepted
- Date: 2026-08-15
- Applies to: TEST-001 — TEST-023

## Context

The Test Module must not mean "run Vitest". It is Vestara's test
orchestration, execution, result, coverage, environment, artifact and evidence
platform — shared by every module, generated app, workflow, agent, integration,
database, API, OS image and marketplace package.

## Decision

**The Test Module determines what was tested and what happened. The Verifier
determines whether that evidence is sufficient.**

### 1. Test taxonomy beyond unit/integration/e2e

`TestType` spans api, database, migration, workflow, agent, tool, skill,
browser, visual, accessibility, performance, security, installation, boot,
recovery, system, acceptance, regression, chaos and more. `TestTargetType`
covers module/service/package/api/os-image/system/repository/custom.

### 2. Suites, Plans, Profiles are distinct

- **Suite** groups tests semantically (these tests belong together).
- **Plan** says "run these tests under these conditions to prove this
  objective".
- **Profile** makes execution repeatable (quick/pull-request/release/nightly).

### 3. Runner contract is discover/plan/execute/cancel

`TestRunner` (capabilities, discover, plan, execute, cancel). Vitest,
Playwright, Pytest, k6, Lighthouse are adapters; none is the module itself.

### 4. Normalized results + evidence

`NormalizedTestCaseResult` gives the rest of Vestara a stable contract.
Every run produces an immutable `TestEvidenceBundle` with a hash — "Agent says
tests passed" is never accepted.

### 5. Flakiness, coverage, regression, impact

- **FlakinessAnalyzer**: full attempt history; a retry that passes never
  erases the original failure.
- **CoverageEngine**: line/branch/function/statement with thresholds.
- **BaselineEngine**: improvement/unchanged/regression/incomparable —
  incomparable is never treated as failure or success.
- **ImpactAnalyzer**: changed artifacts → affected capabilities → minimal
  recommended test set (deterministic graph authoritative; AI augments).

## Consequences

- TEST-001..023 foundation complete: canonical contracts, suites/plans/
  profiles, runner contract + registry, Vitest + HTTP adapters, coverage
  engine, flaky analyzer, baseline/regression, impact analysis, evidence
  bundle, expanded control API (`/api/v2/test/*`).
- 12 tests (9 unit + 3 integration). 521 total.
- TEST-024..032 (discovery UI, requirement traceability, AI assistance,
  API/Database/Agent/Workflow/Browser/OS integrations, Test Center UI) follow.
