# ADR-0032 — OS Image Builder Connectivity & Diagnostics (IMG-027..030)

- Status: accepted
- Date: 2026-08-15
- Applies to: IMG-027 — IMG-030

## Context

The reported "Failed to load profiles. Is the API running?" class of failure
conflated several completely different problems: API unreachable, capability
missing, contract mismatch, server error, and the legitimate empty-profile
state. Treating it as a single generic message made real failures impossible
to diagnose.

## Decision

> **Connectivity is classified, not guessed. The Builder negotiates the API
> contract before use, reports structured failures, and routes every failure
> to a diagnostics surface. Diagnostics observes and investigates; it never
> repairs.**

### 1. API connection manager (IMG-027)

The shared `@vestara/client` remains the single connectivity-aware client.
The startup preflight runs a typed sequence: `/health` -> `/api/v2/system` ->
capabilities -> contract. The UI's `useConnection` drives this through
`ApiClient.negotiate()`.

### 2. Capability/contract negotiation (IMG-028)

- The API now exposes `contractVersion` on `/api/v2/system` (aligned with the
  OpenAPI spec version `2.0.0-alpha.1`).
- `ApiClient.negotiate()` returns a typed `ApiNegotiationResult` and classifies
  a `contract-mismatch` state when the server contract version differs from the
  client's expected version, instead of degrading silently.

### 3. Structured Builder errors (IMG-029)

The UI no longer shows "Is the API running?". It reports distinct states:
API unavailable (with API base and retry), contract mismatch (expected vs
actual), degraded (image capability missing), or the specific server error —
each with Diagnostics and Retry actions.

### 4. Builder diagnostics (IMG-030)

`POST /api/v2/image/diagnostics` runs the image-builder diagnostic
contribution (connectivity, capability presence, profile load) through the
Diagnostics executor and returns structured checks. The UI surfaces it in a
`BuilderDiagnostics` dialog reachable from the connection banner and the
ProfilesPage error alert.

## Consequences

- Connectivity is a typed problem with a diagnostics destination.
- `/api/v2/system` gained `contractVersion`; OpenAPI regenerated and in sync.
- 12 new tests (2 integration for system contract + image diagnostics, 9
  client negotiation/classification, 1 updated flow); 547 backend + 8 UI unit
  passing.
- IMG-031..042 (profile lifecycle, hardware targets, partition designer,
  BuildPlan V2, preflight, BuildRun/checkpoints, event streaming) follow.
