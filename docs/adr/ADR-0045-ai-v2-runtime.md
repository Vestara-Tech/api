# ADR-0045 — AI Module v2: Sessions, Budget, Usage, Trace, Evidence (AI2-011..020)

- Status: accepted
- Date: 2026-08-15
- Applies to: AI2-011 — AI2-020

## Context

AI2-001..010 delivered profiles, provider states and profile-driven routing.
The recommendation adds the durable execution layer: sessions/conversations,
budgets, usage aggregation, tracing and evidence — so Activity Room, Agent
and Workflow share one governed AI execution history without coupling to
provider APIs.

## Decision

> **One governed AI execution path: profile routing -> budget check -> session
> runtime -> usage accounting -> tracing -> evidence. AI Module is governed,
> observable, routable infrastructure that every Vestara package consumes
> consistently.**

### 1. AI session runtime (AI2-011)

`AiSessionManager` owns durable sessions (consumerId, profileId, request
count, token/cost totals) and conversations (message history). Activity
Room / Agent / Workflow share the same execution history.

### 2. Budget/quota engine (AI2-016)

`BudgetEngine` enforces scoped limits (system/organization/user/module/agent/
workflow/task/session): dailyUsd, perRunUsd, tokenLimit, maxRequests. On
threshold -> switch-profile or warn; on hard limit -> deny. Built on the
existing usage accounting, not separate accounting.

### 3. Usage aggregation (AI2-017)

`UsageAggregator` rolls up records into totals (requests/tokens/cost/fallbacks/
p95 latency) and groups by provider/model/module/agent/user.

### 4. Tracing (AI2-018)

`AiTracer` records the request pipeline steps (context assembly, policy,
routing, provider request, tool calls, validation) with per-step durations.

### 5. Evidence (AI2-019)

`buildAiEvidence` produces provenance per request: routing decision (strategy/
selectedFrom/reason), usage, trace id and a deterministic evidence hash.

### 6. Governed execution (AI2-011..019)

`AiRuntimeV2.execute` runs: profile lookup -> budget authorize -> explainable
routing -> generate -> trace step -> usage record -> budget record -> session
usage -> evidence. One path for every module.

## Consequences

- AI2-011..020 complete: session runtime, budget engine, usage aggregation,
  tracing and evidence, wired into one governed execution path.
- New control API: `/api/v2/ai/v2/sessions` (CRUD + conversations + messages),
  `/budgets`, `/usage` (+ grouped), `/traces`. OpenAPI regenerated and in
  sync.
- 9 new tests (6 unit + 3 integration). 742 total.
- AI2-021..025 (evaluation framework, comparison runs, regression baselines,
  routing recommendations) follow.
