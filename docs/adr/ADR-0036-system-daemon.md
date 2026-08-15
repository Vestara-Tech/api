# ADR-0036 — System Daemon, Approvals & Integrations (SYS-052..064)

- Status: accepted
- Date: 2026-08-15
- Applies to: SYS-052 — SYS-064

## Context

SYS-026..056 delivered the normalized inventory, runtimes, storage manager
and the privileged operation protocol. The remaining pieces were the actual
execution plane (vestara-systemd), the approval/rollback governance around
it, and the module integrations that make System the authoritative bridge
between Vestara and the underlying OS.

## Decision

> **The API is the control plane; a privileged vestara-systemd daemon is the
> execution plane. Critical operations require dual approval; stateful
> operations capture rollback pre-images. System owns raw machine health;
> Diagnostics interprets it. Configuration declares desired state; System
> reconciles.**

### 1. Approval workflow V2 (SYS-055)

`ApprovalWorkflow`: risk-based policies (critical -> dual approval, high ->
single, expiry enforced). An approved operation is executable; a rejected or
expired one is not. `approvalId` binds to the operation journal.

### 2. Rollback framework (SYS-057)

`RollbackFramework` captures a pre-image before every stateful mutating
operation; on failure the pre-images restore prior state; on success they
are committed.

### 3. vestara-systemd execution plane (SYS-052)

`VestaraSystemDaemon` executes ONLY typed operations registered by handlers
— never a shell. `devSystemDaemon` honestly reports "not installed" in the
API process. `refuses(kind)` makes the absence of arbitrary operations
structural.

### 4. Configuration reconciliation (SYS-061/062)

`SystemReconciler` compares desired configuration against current system
state (desired -> diff -> plan -> approval -> apply -> verify). No direct OS
file writes from configuration.

### 5. Integrations (SYS-058..064)

`SystemIntegrations` composes the Log sink, Diagnostics port, Generator port
and Image port behind one facade. `health()` measures raw machine health
(API/agent/systemd/boot slot/recovery/CPU/memory) for Diagnostics to
interpret.

### 6. End-to-end flow

`SystemV2Service.daemonExecute` (request -> journal -> approval request ->
rollback pre-image) and `daemonApproveAndRun` (approve -> daemon execute ->
rollback/commit) wire the whole governance loop.

## Consequences

- New control API: `/api/v2/system/daemon/execute`, `/approvals/:id/approve`,
  `/approvals/:id/run`, `/approvals`, `/health`, `/reconcile`. OpenAPI
  regenerated and in sync.
- 13 new tests (10 unit + 3 integration). 613 total.
- The System Module is now the authoritative, governed bridge to the
  underlying operating system: inventory, runtime, storage, typed
  operations, approvals, rollback, reconciliation and module integrations.
  A real `vestara-systemd` daemon can slot in behind the existing ports
  without API changes.
