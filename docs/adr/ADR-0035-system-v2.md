# ADR-0035 — System Module V2 (SYS-026..056)

- Status: accepted
- Date: 2026-08-15
- Applies to: SYS-026 — SYS-056

## Context

The System Module foundation (SYS-001..025) established discovery, boot
presentation, GRUB and the narrow capability boundary. The next step was the
Vestara System Platform: a normalized inventory consumed by all modules,
first-class service/storage/kernel runtimes, and a privileged operation
protocol that replaces the dangerous `sudo arbitrary-command` model.

## Decision

> **System observes and controls the installed machine. Configuration
> declares desired state. Permission governs mutations. Diagnostics
> interprets health. The API is the control plane; a privileged
> vestara-systemd daemon is the execution plane. Arbitrary root operations
> are deliberately not expressible.**

### 1. System inventory (SYS-026..035)

`SystemSnapshot` is one normalized snapshot: identity, OS, firmware (mode,
Secure Boot, TPM), CPU, memory, storage, filesystems, network, graphics,
devices, power, thermal, kernel, boot state. `EnvironmentSystemInventory`
reads what the host exposes safely and reports `unsupported` honestly where
privileged info is absent. Other Vestara modules consume the normalized
model instead of independently reading `/proc`, `/sys`, `lspci`, `lsblk`.

### 2. Runtime (SYS-036..040)

`SystemdServiceManager` makes systemd first-class (start/stop/restart/reload/
enable/disable/status/logs/dependencies; high-impact operations go through
Permission). `discoverKernel` reads `/proc/modules`. Dependency discovery
produces a `DependencyGraph` (`dependenciesOf`/`dependentsOf`).

### 3. Storage manager (SYS-029/030)

Read-only discovery is broad; mutations escalate via `STORAGE_MUTATION_RISK`
(mount MEDIUM, partition-create HIGH, format/erase CRITICAL). Mutations are
typed operations — never arbitrary commands.

### 4. Privileged operation protocol (SYS-052/053/056)

`SystemOperationBroker`: HTTP/API -> Permission -> System Capability -> Typed
Operation -> Approval -> vestara-systemd -> Specific Adapter. Every operation
is journaled (`request -> authorized -> approved -> executing -> completed/
failed/rejected/cancelled`). Deliberately absent: `system.shell.root`,
`system.exec.arbitrary`, `system.firmware.writeArbitrary`.

### 5. Composition (SYS-026..056)

`SystemV2Service` composes inventory + runtime + storage + operation broker,
exposed through `/api/v2/system/*` (snapshot, services, processes, kernel,
storage, operations journal).

## Consequences

- System Module V2 foundation complete: normalized inventory, service/
  storage/kernel runtimes, typed privileged operations with journal.
- New control API: `/api/v2/system/snapshot`, `/services`, `/processes`,
  `/kernel`, `/storage`, `/operations` (+ approve/execute). OpenAPI
  regenerated and in sync.
- 14 new tests (10 unit + 4 integration). 600 total.
- SYS-057..064 (approval workflow V2, rollback framework, diagnostics/log/
  notification/config/generator/test/image integrations) and the
  `vestara-systemd` daemon execution plane follow.
