# ADR-0002 — API Builder: Definition Runtime & AI Governance

- Status: accepted
- Date: 2026-08-15
- Applies to: API2-002 (API Definition Runtime)

## Context

Vestara is adding an API Builder (Strapi-like visual editor) as a first-class
product surface. The builder must not be a thin CRUD screen over random route
registration; it needs a durable domain model that both the visual editor and
future AI-assisted generation operate against. AI is an optional capability:
the builder must remain fully usable without it.

## Decision

### 1. `ApiDefinition` is the central aggregate

All builder work manipulates an `ApiDefinition`: identity, resources
(fields/relations/indexes), endpoints, policies, operations, events, revision,
and metadata. Builder UI and AI both produce/consume this type.

### 2. Explicit lifecycle state machine

`draft → validating → ready → publishing → published`, with
invalid→draft, superseded, and rollback. A published definition is immutable;
editing it starts a new draft cycle on the same id.

### 3. Deterministic contract compilation

The `ContractCompiler` produces TypeBox schemas, OpenAPI 3.1, and route
definitions, and hashes the result with the compiler version. Same definition +
same compiler version ⇒ same hash. The hash is recorded with each published
revision, supporting provenance/evidence.

### 4. AI is an optional, governed capability

- AI never creates live Fastify routes and never publishes.
- AI produces `ApiDefinitionPatch` proposals scoped to a `baseRevision`.
- A human inspects a visual diff, accepts all / selected / edited / rejects.
- Builder code talks only to `ApiBuilderAiPort` — no provider SDKs.
- Capabilities `builder.ai.generate|modify|review|explain|test|document` are
  declared; if no adapter is installed, AI controls are simply absent.

### 5. Drafts can never alter the live API

Route activation is a separate later milestone (API2-005) that consumes a
published revision through a runtime activator. The builder never calls
`fastify.route` directly.

## Consequences

- The Builder UI (API2-006) and Generator/Agent modules both target
  `ApiDefinition`, avoiding a model restructure when AI connects.
- Publishing becomes a versioned, evidence-backed operation.
- The API server remains protected from uncontrolled plugin route mounting.
