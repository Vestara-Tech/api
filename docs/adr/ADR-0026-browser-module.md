# ADR-0026 — Browser Module (BRW-001..009)

- Status: accepted
- Date: 2026-08-15
- Applies to: BRW-001 — BRW-009

## Context

Browser automation is needed for agent verification, research, QA and the
Engineering Workspace. Browser Use is a powerful AI automation runtime but it
must not become Vestara's browser architecture.

## Decision

**Build `vestara.browser`, not `vestara.browser-use`.** Browser Use becomes
the first intelligent runtime; Playwright the deterministic runtime; Vestara
owns sessions, permissions, profiles, tools, events, evidence and workflows.

### 1. Runtime contract

`BrowserRuntime` (capabilities, create/destroySession, navigate, screenshot,
extract, executeTask, cancelTask, streamEvents) — Playwright/CDP for
deterministic execution, Browser Use for agentic reasoning. "Does this require
reasoning?" decides which.

### 2. Profiles and sessions are separate

`BrowserProfile` (runtime, browser, headless, allowed/blocked domains,
credential policy) vs `BrowserSession` (tabs, status, lifecycle). Agents
receive `browserProfileId`, never raw credentials.

### 3. Policy gateway

`BrowserPolicyGateway` reuses governed-execution concepts: navigate/read = low,
interact = medium, execute-script = high (approval required). Agent browser
requests never bypass Vestara governance.

### 4. Evidence per action

`BrowserActionEvidence` (screenshots, url/action trail, extracted data, result)
is captured for every meaningful action and consumed by the Verifier —
completion isn't trusted because an agent said so.

### 5. Human takeover is in the contract

`waiting-human` session state + takeover/resume events so local and remote
implementations evolve independently.

### 6. Browser Use is a sidecar

The Python runtime is isolated behind the runtime contract over an internal
protocol; the main API never depends directly on Python.

## Consequences

- BRW-001..009 foundation complete: contracts, profile/session managers,
  runtime registry, policy gateway, evidence collector, Playwright +
  Browser-Use runtimes, control API (`/api/v2/browser/*`), capability
  `browser`.
- 10 tests (7 unit + 3 integration). 496 total.
- BRW-006 (Activity Room session cards/live preview/takeover), BRW-008
  (Marketplace packaging) and BRW-009 (diagnostics/production hardening)
  follow.
