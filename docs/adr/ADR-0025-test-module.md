# ADR-0025 — Test Module (TEST-001..007)

- Status: accepted
- Date: 2026-08-15
- Applies to: TEST-001 — TEST-007

## Context

Builder defines what should exist, Generator creates it, Test exercises it,
Verifier determines whether the evidence proves the requirement. Without a
platform Test Module, each module invents its own test subsystem and agents
resort to arbitrary shell (e.g. `pnpm test`).

## Decision

**Test is a shared execution + evidence platform.** Testing libraries (Vitest,
Playwright, pytest, k6) are adapters, never architectural concepts.

### 1. First-class contracts

`TestDefinition` (kind, target, runner, configuration, requirements, tags),
`TestSuite`, `TestRun` lifecycle (created → queued → running → completed |
failed | cancelled | error), `TestResult` with per-test status + assertions.

### 2. Runner registry

`TestRunnerContribution` + `TestRunnerRegistry`; modules request capabilities,
a runner is resolved per kind. Marketplace adds testing engines later.

### 3. Adaptors ship now

**Vitest adapter** (unit/integration/component/e2e/visual) and **HTTP/API
adapter** (api/contract/smoke — deterministic status-code verification). Both
produce machine-verifiable `evidenceHash`.

### 4. Evidence is verifier-readable

`TestRun.evidenceHash` is a deterministic hash of the results. Test says
"48/48 passed, evidence hash: ..." — it never says "the feature is correct".
Verifier decides what evidence means.

### 5. Governance rules

`Generated Test ≠ Executed Test ≠ Verified Requirement`. AI can propose tests
and explain failures but can never manufacture test evidence. `test.run` is a
governed operation, not a shell escape hatch.

## Consequences

- TEST-001..007 foundation complete: contracts, runner port, registry,
  Vitest + HTTP adapters, run builder + evidence hash, control API
  (`/api/v2/tests/*`), capability `tests`.
- 6 tests (4 unit + 2 integration). 486 total.
- TEST-012..024 (Context/File/Permission/Generator/Builder/Workflow bridges,
  Agent tools, AI proposal, Verifier/Diagnostics/Notification integration,
  Test Builder UI) follow.
