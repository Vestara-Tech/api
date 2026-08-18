# File Module Expansion — Implementation Checklist

Grounding:

- [ADR-0016 — File Module (FILE foundation)](../adr/ADR-0016-file-module.md)
- [ADR-0051 — Worker module for background jobs and scheduling](../adr/ADR-0051-worker-module-background-jobs-and-scheduling.md)
- [File Module Expansion Roadmap](./file-module-expansion-roadmap.md)
- [Verification policy](../engineering/verification-policy.md)

Status: draft

## Objective

Expand the File Module from the current governed workspace/provider surface
into a broader control plane with stronger provider metadata, tighter workspace
governance, richer transaction evidence, better search/navigation, and remote
provider support.

The core module remains synchronous. If a feature clearly needs background
execution, route that work through the Worker Module instead of introducing a
File-specific runtime.

## Phase 0 — Runtime boundary and baseline

Goal: lock the runtime decision before any feature expansion.

Files:

- `docs/plans/file-module-expansion-roadmap.md`
- `docs/plans/file-module-expansion-checklist.md`
- `docs/adr/ADR-0016-file-module.md`
- `docs/adr/ADR-0051-worker-module-background-jobs-and-scheduling.md`
- `tests/unit/file-module.test.ts`

Add:

- an explicit runtime boundary statement for the File Module
- a classification of long-running work that belongs in the Worker Module
- a baseline inventory of existing File Module providers, sandboxing, and APIs

Checklist:

- [ ] the core File Module is documented as synchronous by default
- [ ] long-running tasks are classified as Worker-backed, not File-backed
- [ ] no File-specific runtime package is introduced
- [ ] the baseline module surface is documented for implementers

Verification:

- [ ] documentation review only
- [ ] no source behavior changes

## Phase 1 — Provider metadata

Goal: make providers first-class, inspectable resources.

Files:

- `src/file/domain/contracts.ts`
- `src/file/providers/file-provider-port.ts`
- `src/file/service/file-service.ts`
- `src/file/providers/memory-provider.ts`
- `src/file/providers/local-provider.ts`
- `tests/unit/file-module.test.ts`

Add:

- provider capability metadata
- provider health/status metadata
- read/write mode flags
- provider mount type declarations
- provider validation hooks

Checklist:

- [ ] providers can be enumerated and classified consistently
- [ ] read-only providers stay read-only by default
- [ ] provider metadata is exposed through `FileService`
- [ ] tests cover provider metadata and mode restrictions

Verification:

- [ ] `pnpm verify:module -- file`
- [ ] `pnpm run test:one tests/unit/file-module.test.ts`

## Phase 2 — Workspace governance

Goal: make mounts, roots, and allowed paths explicit and auditable.

Files:

- `src/file/domain/workspace-sandbox.ts`
- `src/file/service/file-service.ts`
- `src/routes/file.ts`
- `src/bootstrap/file-capability.ts`
- `tests/unit/file-module.test.ts`
- `tests/integration/file-api.test.ts`

Add:

- canonical mount-path normalization
- workspace provenance fields
- mount/unmount lifecycle events
- stricter include/exclude semantics
- permission-aware mount management

Checklist:

- [ ] path escaping is blocked through the public API
- [ ] mount/unmount transitions are emitted
- [ ] workspace provenance is visible in service records
- [ ] control surfaces can explain why a path is allowed or denied

Verification:

- [ ] `pnpm verify:module -- file`
- [ ] `pnpm run test:one tests/integration/file-api.test.ts`

## Phase 3 — Transaction semantics and evidence

Goal: improve preview, rollback, and version evidence for governed writes.

Files:

- `src/file/service/file-service.ts`
- `src/file/providers/file-provider-port.ts`
- `src/file/domain/contracts.ts`
- `tests/unit/file-module.test.ts`
- `tests/integration/file-api.test.ts`

Add:

- richer diff previews for file transactions
- batch validation summaries
- explicit failure reasons per operation
- snapshot metadata for rollback
- more complete version history

Checklist:

- [ ] previews show the exact operation set
- [ ] failed operations are explainable
- [ ] rollback restores from snapshots when available
- [ ] version records are emitted consistently

Verification:

- [ ] `pnpm verify:module -- file`
- [ ] `pnpm run test:one tests/unit/file-module.test.ts`
- [ ] `pnpm run test:one tests/integration/file-api.test.ts`

## Phase 4 — Search and tree inspection

Goal: make the module useful for real workspace navigation.

Files:

- `src/file/providers/memory-provider.ts`
- `src/file/providers/local-provider.ts`
- `src/file/service/file-service.ts`
- `src/routes/file.ts`
- `tests/unit/file-module.test.ts`
- `tests/integration/file-api.test.ts`

Add:

- tree-style directory inspection
- content-aware search where providers support it
- richer stat output
- file hashes and MIME classification consistency
- optional indexing hooks for large workspaces

Checklist:

- [ ] directory and search operations stay fast at current scale
- [ ] metadata is uniform across providers
- [ ] tree inspection exposes the information operators need
- [ ] no File-specific runtime is introduced for search/indexing

Verification:

- [ ] `pnpm verify:module -- file`
- [ ] `pnpm run test:one tests/unit/file-module.test.ts`

## Phase 5 — Remote and artifact providers

Goal: expand the File Module beyond local disk and in-memory support.

Files:

- `src/file/providers/*`
- `src/file/index.ts`
- `tests/unit/file-module.test.ts`
- provider-specific integration tests

Candidate providers:

- artifact store provider
- git-backed provider
- S3-compatible provider
- SFTP/WebDAV provider
- remote workspace provider

Checklist:

- [ ] at least one non-local provider is implemented end to end
- [ ] provider-specific behavior is covered by tests
- [ ] the public API stays stable
- [ ] local disk remains one provider, not the authority

Verification:

- [ ] `pnpm verify:module -- file`
- [ ] provider-specific targeted tests

## Phase 6 — Worker-backed file jobs only where needed

Goal: add background execution without making the whole module async.

Files:

- `docs/adr/ADR-0051-worker-module-background-jobs-and-scheduling.md`
- future `src/worker/*` integration
- `src/file/service/file-service.ts`
- `src/file/tools/file-tools.ts`

Add:

- file job request events
- job payload contracts
- worker handlers for background file tasks
- status/progress reporting back into File events

Use the Worker Module for:

- recursive indexing
- watch/sync propagation
- retention/cleanup
- long-running copy/move/restore operations
- remote provider reconciliation

Checklist:

- [ ] the synchronous File Module path stays the default
- [ ] only long-running work is routed to Worker Module jobs
- [ ] no File-specific runtime package is introduced
- [ ] job state can be inspected through control-plane events

Verification:

- [ ] `pnpm verify:affected`
- [ ] `pnpm verify:module -- worker` when worker-local code is introduced

## Phase 7 — Admin and operator surfaces

Goal: make the module usable by humans as well as agents.

Files:

- `vestara-apps/admin/`
- shared UI primitives in `@vestara/ui`

Add:

- File Manager page
- workspace mount manager
- transaction preview and approval UI
- version timeline
- provider status view
- search and tree browser

Checklist:

- [ ] file operations are visible and auditable in Admin
- [ ] operators can explain why a mount or path is denied
- [ ] write actions always show the governed transaction
- [ ] runtime details stay behind the worker/job boundary

Verification:

- [ ] `pnpm verify:affected`

## Phase 8 — Hardening and compatibility

Goal: finish the module with tests, evidence, and compatibility guarantees.

Files:

- `tests/unit/file-module.test.ts`
- `tests/integration/file-api.test.ts`
- provider conformance tests
- sandbox regression tests
- remote-provider contract tests

Add:

- provider conformance tests
- sandbox path regression tests
- transaction and rollback edge-case tests
- performance budgets for large trees and search
- audit/evidence coverage for file mutations

Checklist:

- [ ] every provider satisfies the same contract suite
- [ ] file governance stays deterministic
- [ ] no hidden runtime dependency is required for core operations
- [ ] evidence is available for the final module behavior

Verification:

- [ ] `pnpm verify:platform`

## Completion rule

This checklist is complete only when:

- the File Module stays synchronous by default
- worker-backed background work is used only where necessary
- provider, sandbox, transaction, and remote-provider coverage is test-backed
- Admin has a clear operational surface for mounts, providers, and transactions
- evidence is recorded by the repository verification policy
