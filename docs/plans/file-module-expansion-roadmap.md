# File Module Expansion Roadmap

Grounding:

- [ADR-0016 — File Module (FILE foundation)](../adr/ADR-0016-file-module.md)
- [ADR-0051 — Worker module for background jobs and scheduling](../adr/ADR-0051-worker-module-background-jobs-and-scheduling.md)

Status: draft

Implementation checklist:

- [File Module Expansion — Implementation Checklist](./file-module-expansion-checklist.md)

## Goal

Expand the File Module from its current governed workspace/provider surface into
the full Vestara file control plane: richer providers, stronger mount/workspace
governance, better preview and rollback behavior, remote storage integration,
and a clean path for background processing when it is genuinely needed.

## Runtime decision

The File Module does not need a dedicated runtime for the core expansion.

The current design is already the right shape for synchronous control-plane
behavior:

- `FileService` governs mounts, reads, searches, transactions, versions, and events.
- `WorkspaceSandbox` enforces path policy before a provider is touched.
- `FileProviderPort` isolates storage backends behind a common contract.
- `MemoryProvider` and `LocalProvider` already cover tests, previews, and local disk.

That means the File Module should stay synchronous unless a feature is clearly
long-running or event-driven.

If the roadmap adds any of the following, use the existing Worker Module as the
runtime instead of inventing a File-specific one:

- large recursive indexing or content scanning
- file-system watches and sync loops
- remote provider reconciliation
- long-running copy/move/restore jobs
- cleanup, compaction, or retention tasks

In other words:

```text
File Module = policy + orchestration + provider contract
Worker Module = background execution when needed
```

## Current baseline

The repository already has:

- `src/file/domain/contracts.ts`
- `src/file/domain/workspace-sandbox.ts`
- `src/file/providers/file-provider-port.ts`
- `src/file/providers/memory-provider.ts`
- `src/file/providers/local-provider.ts`
- `src/file/service/file-service.ts`
- `src/file/tools/file-tools.ts`
- `src/routes/file.ts`
- `src/bootstrap/application.ts` wiring `buildFilePlatform()`
- `tests/unit/file-module.test.ts`
- `tests/integration/file-api.test.ts`

The module already supports:

- workspace mounts and unmounts
- include/exclude sandboxing
- read/list/stat/search operations
- governed transactions
- preview and rollback
- version records
- event emission
- agent tools for read/list/search/write

So the roadmap should extend the current module, not replace it.

## Checkpoint 1 — Formalize provider metadata

Goal: make providers first-class, inspectable resources.

Add:

- provider capability metadata
- provider health/status metadata
- provider read/write mode flags
- provider mount type declarations
- provider validation hooks

Likely files:

- `src/file/domain/contracts.ts`
- `src/file/providers/file-provider-port.ts`
- `src/file/service/file-service.ts`
- `tests/unit/file-module.test.ts`

Implementation rules:

- providers stay behind the port
- providers must never expose raw host filesystem access to callers
- read-only providers should remain the default for local disk

Exit criteria:

- providers can be listed and classified consistently
- tests cover provider metadata and mode restrictions
- no runtime layer is introduced

## Checkpoint 2 — Strengthen workspace governance

Goal: make mounts, roots, and allowed paths explicit and auditable.

Add:

- canonical mount-path normalization
- workspace provenance fields
- mount/unmount lifecycle events
- stronger include/exclude semantics
- permission-aware mount management

Likely files:

- `src/file/domain/workspace-sandbox.ts`
- `src/file/service/file-service.ts`
- `src/routes/file.ts`
- `src/bootstrap/file-capability.ts`

Implementation rules:

- workspace roots remain logical namespaces, not raw host paths
- cross-workspace access stays forbidden
- mount management requires explicit capability gating

Exit criteria:

- path escaping is impossible through the public API
- mount/unmount flows have tests
- admin/control surfaces can explain why a path is allowed or denied

## Checkpoint 3 — Expand transaction semantics

Goal: improve preview, rollback, and evidence for governed writes.

Add:

- richer diff previews for file transactions
- batch validation summaries
- explicit failure reasons per operation
- snapshot metadata for rollback
- more complete version history

Likely files:

- `src/file/service/file-service.ts`
- `src/file/providers/file-provider-port.ts`
- `src/file/domain/contracts.ts`
- `tests/unit/file-module.test.ts`
- `tests/integration/file-api.test.ts`

Implementation rules:

- `Generate ≠ Write` remains the rule
- every mutation must remain transaction-based
- rollback must be evidence-backed, not best-effort only

Exit criteria:

- preview shows exactly what will change
- failed transactions are explainable
- version history is stable and test-covered

## Checkpoint 4 — Broaden search and tree inspection

Goal: make the module useful for real workspace navigation.

Add:

- tree-style directory inspection
- content-aware search where providers support it
- richer stat output
- file hashes and MIME classification consistency
- optional indexing hooks for large workspaces

Likely files:

- `src/file/providers/memory-provider.ts`
- `src/file/providers/local-provider.ts`
- `src/file/service/file-service.ts`
- `src/routes/file.ts`

Runtime note:

- basic search/list/stat remain synchronous
- only heavy indexing should move to Worker Module jobs later

Exit criteria:

- directory and search operations stay fast for the current scale
- metadata is uniform across providers
- no File-specific runtime is added

## Checkpoint 5 — Add remote and artifact providers

Goal: expand the File Module beyond local disk and in-memory test support.

Candidate providers:

- artifact store provider
- git-backed provider
- S3-compatible provider
- SFTP/WebDAV provider
- remote workspace provider

Likely files:

- `src/file/providers/*`
- `src/file/index.ts`
- provider-focused tests

Implementation rules:

- each provider must satisfy the same `FileProviderPort`
- remote providers should be isolated behind integration tests
- local disk remains only one provider, not the authority

Exit criteria:

- at least one non-local provider is added without changing the public API
- provider-specific behavior is covered by tests
- mount/workspace policy remains the same across providers

## Checkpoint 6 — Worker-backed file jobs only where needed

Goal: add background execution without moving the whole module to async.

Use the Worker Module for:

- recursive indexing
- watch/sync propagation
- retention/cleanup
- long-running copy/move/restore operations
- remote provider reconciliation

Do not add a File-specific runtime.

Instead, define:

- file job request events
- job payload contracts
- worker handlers for background file tasks
- status/progress reporting back into File events

Likely files:

- `docs/adr/ADR-0051-worker-module-background-jobs-and-scheduling.md`
- future `src/worker/*` integration
- `src/file/service/file-service.ts`
- `src/file/tools/file-tools.ts`

Exit criteria:

- the File Module stays synchronous by default
- only long-running work uses jobs
- job state can be inspected from the control plane

## Checkpoint 7 — Admin and operator surfaces

Goal: make the module usable by humans as well as agents.

Add:

- File Manager page
- workspace mount manager
- transaction preview / approval UI
- version timeline
- provider status view
- search and tree browser

Likely targets:

- `vestara-apps/admin/`
- shared UI primitives in `@vestara/ui`

Implementation rules:

- UI shows policy, not hidden behavior
- write actions always show the governed transaction
- runtime details should stay behind the worker/job boundary

Exit criteria:

- file operations are visible and auditable in Admin
- operators can understand why a mount or path is denied
- file mutation UX matches the control-plane contract

## Checkpoint 8 — Hardening and compatibility

Goal: finish the module with tests, evidence, and compatibility guarantees.

Add:

- provider conformance tests
- sandbox path regression tests
- transaction and rollback edge-case tests
- remote-provider contract tests
- performance budgets for large trees and search
- audit/evidence coverage for file mutations

Exit criteria:

- every provider satisfies the same contract suite
- file governance stays deterministic
- no hidden runtime dependency is required for core operations

## Recommended sequencing

1. Provider metadata
2. Workspace governance
3. Transaction semantics
4. Search/tree inspection
5. Remote/artifact providers
6. Worker-backed jobs only where necessary
7. Admin surfaces
8. Hardening

## Bottom line

The File Module should continue as a governed control-plane module.

It does not need its own runtime for the core roadmap.
If background execution becomes necessary, reuse the Worker Module and keep the
File Module as the policy/orchestration surface.
