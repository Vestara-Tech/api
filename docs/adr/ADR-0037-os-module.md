# ADR-0037 — OS Module (OS-001..007)

- Status: accepted
- Date: 2026-08-15
- Applies to: OS-001 — OS-007

## Context

System Module owned hardware/firmware/discovery/privileged operations. OS
concerns (distribution, packages, kernel configuration, users, services,
login, desktop, updates, recovery) were being added ad hoc. The recommendation
established the hierarchy:

```
Firmware -> System Module -> OS Module -> Vestara Runtime -> Applications
```

System Module = the machine. OS Module = the operating system installed on
that machine. Image Builder = creates an operating-system image.

## Decision

> **The OS Module is Vestara's normalized control plane for an installed
> operating system: identity, distribution, packages, kernel configuration,
> users, services, sessions, desktop, startup, login, updates, recovery and
> OS lifecycle. It never mutates /etc directly and never gets arbitrary root
> execution — privileged writes go through the System Module.**

### 1. OS domain contracts (OS-001/004)

`OsProfile` is the canonical declarative definition of an operating system:
identity, distribution, kernel, packages, services, users, startup, login,
desktop, network, locale, security, updates, recovery. Distribution-specific
assumptions are never encoded in the domain contract.

### 2. Discovery (OS-002)

`DistributionDiscovery` reads `/etc/os-release` and classifies distribution +
package manager (debian/ubuntu -> apt, fedora -> dnf, arch -> pacman).
`EnvironmentOsDiscovery` captures the CURRENT OsProfile; privileged gaps
(packages, services) degrade honestly.

### 3. Capability registry (OS-003)

Safe read/inspect/propose capabilities (`os.inspect`, `os.packages.read`,
`os.configuration.propose`, `os.update.plan`) are agent-safe. Governed writes
(`os.package.install`, `os.user.delete`, `os.update.apply`,
`os.recovery.execute`) require permission + approval. `os.shell.root` and
`os.exec.arbitrary` are absent by design.

### 4. State model (OS-005/006/007)

`OsStateModel` = current + desired + drift. `diffOsProfiles` produces a
categorized diff across all profile sections. `planOsChanges` compiles it into
an ordered change plan with per-change risk (low/medium/high/critical), reboot
and approval requirements, and System Module capability gates (kernel params,
user creation, repositories). Plans, not mutations: apply requires approval
and delegates privileged writes to the System Module.

## Consequences

- OS Module foundation complete: OsProfile, discovery, capabilities,
  desired/current state model, diff engine, change planner.
- New control API: `/api/v2/os/current`, `/desired` (GET/PUT), `/state`,
  `/diff`, `/plan`, `/capabilities`. OpenAPI regenerated and in sync.
- 15 new tests (11 unit + 4 integration). 628 total.
- OS-008..040 (package/repository/kernel/users/sessions/startup/login/
  desktop/updates/A-B/rollback/recovery subsystems, Configuration/Generator/
  Permission/Authentication/Diagnostics/Test integrations, Image Builder +
  Onboarding + Marketplace integration, Debian adapter, Control API, events,
  evidence) follow.
