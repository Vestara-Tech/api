# ADR-0044 — AI Module v2: Profiles, Provider States, Routing (AI2-001..010)

- Status: accepted
- Date: 2026-08-15
- Applies to: AI2-001 — AI2-010

## Context

The AI Module foundation (AI-001..023) correctly separates catalog, domain,
policies, providers, runtime and service. The recommendation makes AI the
**shared AI execution and governance plane** for Vestara:

```
Modules consume AI capabilities. Modules DO NOT own provider integrations.
```

The critical new abstraction is `AiProfile`: modules reference
`profile: vestara.coding` instead of configuring
`provider/model/temperature/fallback` everywhere.

## Decision

> **AI Module = intelligence infrastructure. Agent = autonomous actors.
> Context = contextual information. Tool = executable capabilities.
> Providers are dynamically installable adapters with three states
> (Installed / Configured / Enabled); credentials remain secret references.
> Routing is explainable and profile-driven.**

### 1. AiProfile (AI2-001)

`AiProfile` = named, routable model configuration: capability requirements,
routing strategy, optional explicit fallback chain, parameters and budget
hints. Built-in profiles: reasoning, fast, coding, vision, embedding,
background, local-first, privacy-first. Modules reference profile ids, never
provider/model ids.

### 2. Provider lifecycle states (AI2-002)

`AiProviderConfig` tracks installed/configured/enabled + health
(healthy/degraded/offline/unknown) + credentialRef (secret reference).
`providerState()` derives the lifecycle state; `isProviderUsable()` gates
routing; health scoring deprioritizes unhealthy providers.

### 3. Routing engine v2 (AI2-006..010)

`RoutingEngineV2.route(profile)` resolves via: capability requirements ->
availability filter (provider state + health) -> candidate ranking ->
routing strategy. Strategies: fixed, best-capability, lowest-cost,
lowest-latency, highest-reliability, balanced, local-first, cloud-first,
privacy-first, custom. Explicit fallback chains fail over ONLY on specific
conditions (timeout/rate-limit/unavailable/context-overflow/provider-error) —
never blindly on semantic failures. Every decision is explainable
(profile, strategy, selectedFrom, reason, fallback chain).

## Consequences

- AI2-001..010 foundation complete: profiles, provider states, health-aware
  profile-driven routing with fallbacks and strategies.
- New control API: `/api/v2/ai/v2/profiles`, `/providers`, `/route`,
  `/route/eligible`. OpenAPI regenerated and in sync.
- 15 new tests (11 unit + 4 integration). 733 total.
- AI2-011..025 (session/conversation runtime, context integration, token
  budgeting, tool + permission bridges, budget/quota engine, usage
  aggregation, tracing, evidence, evaluation framework, comparison runs,
  regression baselines) follow.
