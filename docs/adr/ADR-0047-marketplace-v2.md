# ADR-0047 — Marketplace v2: Universal Capability Distribution (MKT2-001..017)

- Status: accepted
- Date: 2026-08-15
- Applies to: MKT2-001 — MKT2-017

## Context

Marketplace v1 (ADR-0020) established the distribution-plane foundation
(catalog, compatibility, registry, lifecycle, governed install). Since then
the platform gained AI, builders, generators, themes, templates, dashboards,
users and OS. The recommendation moves Marketplace to **v2: the universal
Vestara capability distribution platform**, extending the existing foundation
rather than rebuilding it.

## Decision

> **Marketplace = Discover / Distribute / Install / Update. Packages declare
> explicit `provides`/`requires`/`optional` contributions. Marketplace
> resolves package + capability + module dependencies. Marketplace never
> calls the provider/module — modules execute their own contributions.**

### 1. Extended taxonomy (MKT2-001)

`VestaraPackageKind` extended to ~45 kinds across Applications, Modules,
AI (provider adapters, model packs, profiles, routing policies, evaluators),
Agents (agents, skills, tools, instruction packs), Automation, Builders,
Generators, UI (components, themes, templates, pages, dashboard packs),
Data, System (OS components, boot/login/desktop themes, image profiles),
Developer.

### 2. Contribution manifest v2 (MKT2-002)

`ContributionManifestV2` declares `provides` (kind + id + name) and
`requires`/`optional` (module + capability). `ContributionRegistryV2`
registers on install, unregisters on disable — Marketplace distributes,
modules execute.

### 3. Capability resolver (MKT2-003)

`CapabilityResolver` resolves package deps + capability deps + module deps +
optional deps against the enabled platform, reporting missing required
capabilities.

### 4. Bundles + distributions (MKT2-004/005)

`package` = installable unit; `bundle` = groups packages; `distribution` =
curated Vestara configuration. `planDistribution` produces the install plan
(required/recommended/optional/AI).

### 5. Trust, signing, security, evidence (MKT2-011..014)

`TrustLevel` (vestara-official/verified-publisher/community/local/
development); `signPackage` deterministic signing; `runSecurityScan` blocks
critical/high findings; `buildPackageEvidence` produces a verifiable bundle.

### 6. Publisher + publishing plane (MKT2-016/017)

`MarketplacePublisherService` registers publishers with trust levels and
publishes through the governed flow (publisher -> build -> security scan ->
evidence -> sign -> publish), refusing unknown publishers.

## Consequences

- Marketplace v2 foundation complete: extended taxonomy, contribution
  manifest v2, capability resolver, bundles, distributions, trust/signing/
  security/evidence, publisher model.
- New control API: `/api/v2/marketplace-v2/contributions`, `/provides/:kind`,
  `/resolve`, `/bundles`, `/distributions` (+ plan), `/publishers`,
  `/publish`, `/published`. `marketplace-v2` capability registered.
  OpenAPI regenerated and in sync.
- 14 new tests (10 unit + 4 integration). 766 total.
- MKT2-006..010 (configuration/AI/builder/generator/UI/OS contributions
  wiring), MKT2-018..020 (version/channel management, update policies,
  dependency impact analysis), and MKTUI (Discover, Package details,
  Installation review, Installed control center, Package Builder, Publisher
  Console) follow.
