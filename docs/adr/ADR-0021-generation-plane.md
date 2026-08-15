# ADR-0021 — Generation Plane (GEN-X)

- Status: accepted
- Date: 2026-08-15
- Applies to: GEN-X01 — GEN-X10

## Context

Modules (API Builder, Agent Builder, Workflow Builder, Database, Integration,
System) all need generation. If each implements its own generation engine,
Vestara gains substantial duplication and divergent lifecycles. The existing
Generator Module already owns plan/generate/validate/preview/apply/verify.

## Decision

The Generator Module becomes the platform-wide **Generation Plane**; modules
become generator contributors and consumers.

### 1. One contribution contract

`GeneratorContribution` (id, moduleId, category, capabilities, inputSchema,
outputKinds, permissions, createGenerator) — modules register generation
capabilities instead of building new engines:

```text
api.resource · agent.definition · workflow.definition · test.api
```

### 2. Capability registry, not generator ids

Callers request a capability ("agent.definition"), resolved by
`GenerationCapabilityRegistry` to a compatible generator. Marketplace-installed
generators register identically.

### 3. Typed intents

`GenerationIntent` (api.endpoint, agent.definition, workflow.definition,
database.schema, integration.adapter, test.api, ...) — AI creates intents, the
deterministic plane processes them. Never "AI writes arbitrary files".

### 4. Context via providers

`GenerationContextProvider` keeps the plane decoupled from File, Config,
Database, Marketplace, etc.

### 5. Generic targets + Generate ≠ Write

`GenerationTarget` / `GenerationTargetAdapter` generalize `ArtifactApplyPort`
to filesystem, database, configuration, api-definition, agent-definition,
workflow-definition, marketplace-package, system-image. Apply remains a governed
operation.

### 6. Permission at two boundaries

`GeneratorPermissionBridge` separates `canGenerate` from `canApply`. An agent
can propose/run all day without authority to mutate the system.

### 7. AI proposes, plane executes

Natural language → AI → GenerationIntent → plane → plan → preview → review →
apply. Deterministic infrastructure owns execution.

## Consequences

- GEN-X01..X10 foundation complete: contribution contract, capability registry,
  typed intents, context provider contract, generic targets, permission bridge
  (generate vs apply), built-in module contributions (api/agent/workflow/test),
  control API (`/api/v2/generation/*`).
- 6 tests. 446 total.
- GEN-X11..X19 (database/agent/skill/workflow/integration/configuration/
  marketplace/system generators) and GEN-X20..X25 (generation graph,
  transactional multi-module apply, rollback) follow.
