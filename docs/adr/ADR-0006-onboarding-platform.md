# ADR-0006 — Onboarding Platform (ONB-001..009)

- Status: accepted
- Date: 2026-08-15
- Applies to: ONB-001 — ONB-009 (Foundation + Planning checkpoint)

## Context

Vestara OS, containers, dev environments, and hosted deployments all need a
first-run experience. It must be a permanent platform capability (also driving
recovery, adding an organization, provisioning a node), not UI-only wizard code.
Onboarding should orchestrate real capabilities (Authentication, Configuration,
Generator) rather than mocks.

## Decision

### 1. Onboarding orchestrates; it does not own the systems it configures

Each operation (`identity.create`, `config.apply`, `generator.apply`,
`package.install`, `integration.configure`, `system.configure`) delegates to its
owning capability. Onboarding never reimplements them.

### 2. Explicit, durable installation state

First-run is never inferred from "no users". `InstallationState` transitions
`uninitialized → bootstrap → planning → awaiting-approval → configuring →
verifying → ready`, with `failed` → retry/resume/rollback.

### 3. Bootstrap security

Before the first owner exists, a one-time bootstrap token gates the restricted
onboarding API. Completing the first owner invalidates it irreversibly; ordinary
public API calls can never re-enable bootstrap.

### 4. Plans are immutable once approved

`OnboardingSession` answers are editable until approval. `OnboardingPlan`
carries a `planHash`; any change after approval produces a new plan (new
revision + new hash) requiring fresh approval — matching Generator's governance.

### 5. Contributors, not a fixed wizard

`OnboardingContributor` (`isAvailable/describe/validate/plan`) lets each
capability contribute a step. The future `vestara-apps/onboarding` UI renders
these definitions instead of encoding a 12-page wizard.

### 6. No mutation without a checkpoint

ONB-001..009 (state/bootstrap/session/contributor/discovery/planning) are built
and verified before the execution engine (ONB-010..016). Onboarding is not yet
allowed to mutate a Vestara installation.

## Consequences

- First boot becomes a governed platform composition workflow.
- Authentication/Configuration/Generator are already consumable by onboarding.
- SYS-001..014 (system/firmware) will provide the privileged capability
  boundary ONB only orchestrates.
