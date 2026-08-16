# ADR-0047 — Marketplace v2: Universal Capability Distribution (MKT2-001..020)

- Status: accepted
- Date: 2026-08-15
- Applies to: MKT2-001 — MKT2-020

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

### 7. Live platform contribution wiring (MKT2-006..010)

`registerPlatformContributions` registers the actual platform modules as
distributable contributions at bootstrap: configuration contributions,
AI providers/profiles/evaluators, builders, generators, UI
components/themes/templates, OS + image profiles. Every module is
independently installable/updatable through the governed package system.

### 8. Version/channel management (MKT2-018)

`PackageVersionService` publishes versions to channels (stable/beta/
development/canary), promotes versions between channels, and resolves the
latest version of a channel for installs. Local registry remains
authoritative; offline installs keep working.

### 9. Update policies (MKT2-019)

`UpdatePolicyEngine` decides per package+channel: auto applies compatible
releases, prompt asks, manual requires explicit action, hold never
auto-advances. Major bumps are gated under auto/prompt via `blockMajor`.

### 10. Dependency impact analysis (MKT2-020)

`DependencyImpactAnalyzer` finds every installed package depending on the
target, verifies their version ranges still hold, and diffs capability
requires so the update decision is evidence-driven (`breaking` flag).

## Consequences

- Marketplace v2 complete: extended taxonomy, contribution manifest v2,
  capability resolver, bundles/distributions with install plans,
  trust/signing/security/evidence, publisher model, live platform
  contribution wiring, version/channel management, update policies,
  dependency impact analysis.
- New control API: `/api/v2/marketplace-v2/contributions`, `/provides/:kind`,
  `/resolve`, `/bundles`, `/distributions` (+ plan), `/publishers`,
  `/publish`, `/published`, `/versions`, `/versions/promote`,
  `/updates/policy`, `/updates/evaluate`, `/impact`. `marketplace-v2`
  capability registered. OpenAPI regenerated and in sync.
- 26 new tests. 788 total.
- MKTUI (Discover, Package details, Installation review, Installed control
  center, Package Builder, Publisher Console) and the Onboarding v2
  Provisioning & Composition engine (ONB-010..) follow.
