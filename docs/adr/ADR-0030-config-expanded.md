# ADR-0030 — Expanded Configuration (CONFIG-009..016)

- Status: accepted
- Date: 2026-08-15
- Applies to: CONFIG-009 — CONFIG-016

## Context

CONFIG-001..008 established the correct foundation: schema registry, layered
resolver, validation, secret references, lifecycle/revisions, watchers. The
next step is turning Configuration into the **control plane for all Vestara
packages, modules, applications, services, agents, builders, generators,
integrations and OS components**.

## Decision

> **Modules own their configuration schema. Configuration owns state,
> resolution, validation, lifecycle, provenance, secret references,
> distribution and change governance.**

### 1. Contribution contract (CONFIG-009)

`ConfigurationContribution` (packageId, namespace, fields with rich metadata —
type, required, secret, immutable, **reloadBehavior**, **risk**, enumValues).
Marketplace installation registers schemas automatically.

### 2. Operational impact (CONFIG-015)

`ConfigurationImpactAnalyzer` derives affected modules/services, required
restarts, regeneration, reboot and risk from field metadata. Changing
`ui.theme` is hot-reload; `api.port` is service-restart; `system.kernel.*` is
system-reboot. Config changes are much safer when impact is known before apply.

### 3. Transactions (CONFIG-014)

`ConfigurationTransactionService`: multiple changes are **atomic**
(draft → validate → impact → approve → apply → commit), with rollback on
failure. Never a partially configured system.

### 4. Provenance (CONFIG-013)

`ProvenanceEngine`: every resolved value answers "where did this come from?"
with the full inheritance chain (default → system → environment → workspace →
...).

### 5. Scope hierarchy (CONFIG-012)

Explicit `ConfigurationScopeType` hierarchy without hardcoding every scope in
the resolver.

## Consequences

- CONFIG-009..016 foundation complete: contribution contract, rich field
  metadata, contribution registry, scope hierarchy, provenance engine, impact
  analyzer, transaction service, control API expansion
  (`/api/v2/config/contributions|fields|impact|transactions`).
- 9 tests (6 unit + 3 integration). 530 total.
- CONFIG-017..034 (restart orchestration, secret providers, migrations,
  presets, drift detection, health, Generator/Builder/Context/Diagnostics/
  Test/Marketplace integration, AI proposals, evidence) follow.
