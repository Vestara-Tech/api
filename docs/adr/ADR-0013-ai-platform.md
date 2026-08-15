# ADR-0013 — AI Platform Module (AI-001..006 foundation)

- Status: accepted
- Date: 2026-08-15
- Applies to: AI-001 — AI-006

## Context

Vestara modules (API Builder, Generator, Database Builder, agents) each need
LLM capability. If each module integrates a provider SDK directly, Vestara
gains vendor lock-in and loses centralized routing, cost accounting, policy,
and governance. The foundation must be deterministic before inference adapters
are introduced.

## Decision

### 1. Modules depend on `AiRuntime`, never on a provider

Consuming modules target the AI service contract (`generate`, `stream`,
`embed`, `resolveModel`). OpenAI, Anthropic, Google, OpenRouter, Ollama and
other providers stay behind provider adapters. Provider SDKs never escape
adapters; the built-in adapter is OpenAI-compatible over plain fetch and
imports no vendor package.

### 2. models.dev is catalog metadata, not the runtime

models.dev (`api.json`, `models.json`) is a provider/model metadata catalog.
Vestara uses it for discovery and normalization only. `ModelsDevCatalogAdapter`
maps its shape into the normalized `AiModel` model (capabilities, modalities,
context limits, pricing, open-weight, lifecycle). Inference never depends on a
models.dev network call.

### 3. Catalog cache + offline snapshot

A validated snapshot (`CatalogSnapshot` with a checksum) is persisted locally.
`CatalogCache.load()` validates the checksum; tampered or missing snapshots
return `null` and Vestara stays usable without the network. AI execution never
blocks on catalog availability.

### 4. Provider configuration is data, not code

`AiProvider` (id, name, type, enabled, priority) is data. The
`AiProviderRegistry` holds providers + adapters. API keys remain secret
references (`secret://integrations/<provider>/api-key`) supplied by the
Integration module — never stored as AI-module configuration values.

### 5. Model routing is capability-driven

Callers may request an explicit provider/model or a capability selector
(`reasoning`, `tools`, `structuredOutput`, `minContext`, input modalities) with
an optimization profile (quality/balanced/cost/latency/local/offline/auto).
The router honors provider enablement, capability compatibility, context
requirements, and preference before selecting a model.

### 6. AI-generated mutations are proposals unless governed

The AI module never performs mutations by itself; higher-risk actions remain
separately governed by the consuming module (matching the API Builder and
Generator proposal→review→apply rule).

## Consequences

- Foundation AI-001..006 complete: contracts, provider abstraction + registry
  (OpenAI-compatible first), normalized model catalog, models.dev adapter,
  validated cache/offline snapshot. 11 tests added (312 total).
- AI-007+ (normalized generation, streaming, structured output, tool calling,
  embedding), AI-012+ (routing profiles, fallback chains), AI-016+ (config/
  secret/capability integration), and AI-023+ (control API) follow in later
  milestones.
