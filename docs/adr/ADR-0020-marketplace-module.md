# ADR-0020 — Marketplace Module (MKT foundation)

- Status: accepted
- Date: 2026-08-15
- Applies to: MKT foundation

## Context

Vestara ships Agents, Skills, Tools, Workflows, Generators, Builders, AI
providers, integrations and OS components. Without a distribution surface,
these are hardcoded into the platform. Vestara also needs to work offline.

## Decision

**Marketplace is the distribution plane; modules remain the execution plane.**
Marketplace manages discovery, acquisition, installation state, provenance,
compatibility, updates and lifecycle orchestration. The underlying
Module/App/Agent/Tool/Skill/Workflow systems load and execute what was
installed.

### 1. One universal artifact: VestaraPackage

`VestaraPackage` (id, version, kind, publisher, manifest, dependencies,
permissions, capabilities, compatibility, artifacts, provenance) covers
app/module/agent/skill/tool/workflow/integration/generator/builder/providers/
templates/themes/standards-packs/os-components/knowledge-packs. There is no
separate installation system per kind.

### 2. The local registry is authoritative

`LocalPackageRegistry` holds available + installed state. A cloud registry is
never the source of truth for what is installed. The bundled `builtinCatalog`
makes core packages available offline.

### 3. Invariants are explicit

`Downloaded ≠ Installed ≠ Enabled ≠ Running`. Lifecycle states track each
(`available → resolving → … → installed → enabled → running`, plus
`update-available`, `rollback-available`, `disabled`, `failed`, `quarantined`,
`uninstalling`).

### 4. Installation is governed

`InstallationService` pipeline: resolve package → resolve dependencies →
compatibility analysis → permission analysis → **approval gate** → stage →
verify → register. High-risk permissions (explicit approval, high/critical
risk) require approval before install. Marketplace only DECLARES permissions;
the Permission Module owns the authority decision.

### 5. Separation of Permission vs Capability

Package permissions ("what authority does this request?") and capabilities
("what functionality does this contribute?") are distinct.

### 6. Contribution registration is the extension seam

`MarketplaceContributionRegistry` registers agents/tools/skills/workflows/
modules/generators/permissions/capabilities contributed by a package. The
platform modules pick these up; Marketplace never understands a package's
implementation.

### 7. Compatibility is contextual, not just semver

`CompatibilityAnalyzer` checks API/platform version, OS, architecture, Node,
required module versions and conflicts.

## Consequences

- MKT foundation complete: package contracts, local registry, bundled catalog,
  catalog service (search/categories), version + dependency resolvers,
  compatibility analyzer, artifact verifier, permission analyzer, governed
  installer, lifecycle (enable/disable/uninstall/update/rollback), contribution
  registry, control API (`/api/v2/marketplace/*`), capability `marketplace`.
- 16 tests (10 unit + 6 integration). 440 total.
- MKT-011..012 (artifact/provenance deep verification), MKT-022 (events/audit),
  MKT-024 (Marketplace UI) and the publisher/developer console follow.
