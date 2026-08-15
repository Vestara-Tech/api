# ADR-0022 — Diagnostics Module (DIAG-001..009)

- Status: accepted
- Date: 2026-08-15
- Applies to: DIAG-001 — DIAG-009

## Context

Vestara has many independently operating domains (Agent, AI, Auth, Builder,
Configuration, Context, File, Generator, Image Builder, Marketplace, System,
Workflow). Operators need to ask "what appears wrong?" and get a structured
answer, not a generic frontend error. The OS Image Builder connectivity failure
("Failed to load profiles. Is the API running?") demonstrated the gap.

## Decision

> **Diagnostics observes and investigates. It does not decide correctness, own
> module health, or silently repair the system.**

### 1. Contribution contract

`DiagnosticContribution` (checks + run) — modules register diagnostic checks;
Diagnostics never imports every module. Includes System, API and Image Builder
contributions.

### 2. Check + finding + severity model

Checks return `pass | fail | degraded | unknown | unsupported | skipped` with a
severity (`info | warning | error | critical`). `unknown` is preserved — missing
evidence is never converted into failure. Findings carry likely causes and
optional remediation proposals.

### 3. Run lifecycle + scope

`created → discovering → running → analyzing → completed | partial | failed |
cancelled`. Runs support scopes (system, module, service, agent, workflow,
browser, database, ...) and module targets.

### 4. OS Image Builder dogfood

The Image Builder diagnostic reports API reachability, capability presence and
profile loading **independently** — the exact class of failure that previously
collapsed into a single generic error.

### 5. Diagnostics vs Test vs Verifier vs Monitoring

```text
Diagnostics = "What appears wrong?"
Test        = "Does expected behavior hold?"
Verifier    = "Does evidence support the claim?"
Monitoring  = "What is happening over time?"
```

They share evidence but remain independent. Diagnostics never repairs; the
remediation path is proposal → Permission → Workflow/Agent → action → re-run.

## Consequences

- DIAG-001..009 foundation complete: contracts, contribution, registry, run
  executor, finding/severity model, System/API/Image-Builder adapters, control
  API (`/api/v2/diagnostics/*`), capability `diagnostics`.
- 9 tests (5 unit + 4 integration). 460 total.
- DIAG-010..020 (database/browser/agent/generator adapters, permission +
  remediation contracts, AI analysis bridge, Diagnostics UI) follow.
