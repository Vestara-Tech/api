# ADR-0004 — Configuration Platform (CONFIG-001..008)

- Status: accepted
- Date: 2026-08-15
- Applies to: CONFIG-001 — CONFIG-008

## Context

Authentication, Generator, Integration, Database, API Builder, agents,
packages, and services all need typed configuration. Configuration must not be
a glorified `.env` reader — it needs layered precedence, validation, secret
references, revision/rollback, and change observability. It must also remain
independent of the API server so it can later become a separately installable
Vestara package.

## Decision

### 1. Configuration is a platform module, not an API submodule

Dependency direction is `API → Configuration`, never
`Configuration → API internals`. Generator will consume the same module.

### 2. Packages register schemas

Each package registers a `ConfigurationDefinition<T>` (namespace, version,
schema, defaults, scopes, secret fields). Schema-generated settings UIs become
possible without bespoke per-package screens.

### 3. Deterministic layered precedence

`defaults → system → environment → organization → workspace → project →
module → service → runtime`. Runtime overrides (set programmatically) win.
Scopes are extensible: packages may add dimensions beyond the built-ins.

### 4. Secrets are references, never values

Configuration stores `SecretReference` (`secret://store/path`). A
Credential/Secret store resolves at use time. `redactSecrets` prevents leaking
secret-bearing keys in events, logs, or the API.

### 5. Governed lifecycle

`draft → validate → apply → active`, with revision history and rollback.
Change events carry hot-reload vs restart-required semantics so modules react
instead of polling.

### 6. Capabilities

`config.read/write/validate/resolve/watch/history/rollback/schema.register` —
discoverable through the capability registry.

## Consequences

- OAuth/integration provider configuration (AUTH-007+) reuses this module
  rather than building config infrastructure inside Auth.
- Generator consumes typed config for templates/output (GEN-001+).
- Configuration Builder UI can be schema-generated (CONFIG-009/010).
