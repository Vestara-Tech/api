# ADR-0017 — Context Module (CTX foundation)

- Status: accepted
- Date: 2026-08-15
- Applies to: CTX foundation

## Context

Vestara accumulates files, memory, workflow state, agent state, skills, tools,
git, activity, evidence, configuration and integrations. If each consuming
module concatenates these into a giant prompt, agents cannot be inspected,
reproduced, governed or budgeted. The seed `assembleAgentContext()` was
agent-specific and string-oriented.

## Decision

The distinction is locked:

```text
Memory  = what Vestara retains
Context = what Vestara selects and presents NOW
```

### 1. Context is a typed collection, not a prompt string

`ContextItem` (source kind, content, priority, relevance, tokenEstimate,
required, sensitive, metadata) composed into a `ContextBundle` with a budget,
provenance and purpose. Execution consumes a bundle, never raw concatenation.

### 2. Scopes make inheritance deterministic

System → Organization → Workspace → Project → Workflow → Run → Agent → Task →
Turn. Ranking favors items closer to the requesting scope; lower scopes narrow,
not escalate.

### 3. Modules contribute through a contract

`ContextProvider` (id, kinds, scope, collect) with a `ContextProviderRegistry`.
The first built-ins: Agent, Workflow, File. Marketplace modules can add
providers without modifying Context Core.

### 4. Assembly is an explicit pipeline

Discover → collect → authorization filter → sensitivity filter → relevance
ranking → deduplication → token budget → composition. Required items (agent
instructions, task, permissions) always survive the budget and never depend on
semantic retrieval.

### 5. Context can access a file ≠ agent can see it

The collector applies an authorization filter per candidate. A sensitive item
is excluded unless the principal passes the sensitivity gate — Context access
never implies Agent access.

### 6. Token budgeting is a Context responsibility

`ContextBudget` (maximum, reserved output/system, available context) with
per-source allocations; the collector redistributes dynamically while keeping
required items.

### 7. Snapshots + provenance make runs reproducible

`ContextSnapshot` (id, bundleHash, run/agent/workflow refs, item list) and
`ContextProvenance` per item. If an agent makes a bad decision, Vestara can
answer: "What information did the agent actually have?"

## Consequences

- CTX foundation complete: contracts, scopes, provider contract + registry,
  collector pipeline (authorization, sensitivity, ranking, dedup, budget),
  snapshots/hashes, the first three providers (agent, workflow, file), a
  service facade, control API (`/api/v2/context/*`), capability `context`.
  114→122 OpenAPI paths.
- 13 tests (9 unit + 4 integration).
- `assembleAgentContext()` remains as the agent adapter for now; CTX-018
  (AI-assisted retrieval), CTX-020 (Context Inspector/Builder UI) and full
  Agent/Workflow integration follow.
