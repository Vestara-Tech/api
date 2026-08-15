# ADR-0016 — File Module (FILE foundation)

- Status: accepted
- Date: 2026-08-15
- Applies to: FILE foundation

## Context

Agents, Workflows, Generator, Builders and Marketplace packages all need files.
If each module manipulates arbitrary host paths directly, Vestara gains no
uniform policy, sandboxing, transactions, provenance or portability. The
existing Generator owns artifact semantics, not filesystem mutation.

## Decision

The core rule is locked:

> Modules do not directly manipulate arbitrary files. They request governed
> file capabilities from the File Module.

### 1. Files belong to provider/mount namespaces, not host paths

A `FileResource` has a namespaced `path` (`workspace://...`, `artifact://...`,
`temp://...`, `user://...`, `system://...`). `path` never implies an
unrestricted host OS path.

### 2. Capability-oriented, not `filesystem.*`

The platform capability is the **File Module**, and it exposes `file.*`
capabilities (read/list/stat/search, create/write/delete, transaction,
version, artifact, mount) with explicit risk classification
(read / low / high / critical). "Filesystem" would imply local POSIX/Windows;
File Module uniformly represents local files, artifacts, remote workspaces,
virtual files and future cloud storage.

### 3. Workspaces are first-class with path sandboxing

`FileWorkspace` (id, root, provider, include/exclude patterns, permissions,
revision). `WorkspaceSandbox` resolves and enforces include/exclude patterns
BEFORE an operation reaches a provider. An engineering agent receives
`src/**`/`tests/**` allowed and `.git/**`/`node_modules/**`/`.env`/`secrets/**`
denied — never arbitrary root filesystem access.

### 4. Providers behind a port

`FileProviderPort` (read/list/stat/search/create/write/remove/mkdir/copy/move,
optional snapshot/restore). `MemoryProvider` (tests, previews, ephemeral) and
`LocalProvider` (single host directory, read-only by default) ship now; S3,
Git, SFTP, WebDAV and remote workspaces come later via the Integration module.

### 5. Mutations are governed transactions (Generate ≠ Write)

`FileTransaction` (draft → validated → awaiting-approval → applying → applied |
failed → rolled-back) over `FileOperation`s with preview/diff, policy
validation, apply, and snapshot-based rollback. Generator keeps generating
artifacts; the File Module owns filesystem mutation. Agents become File Module
clients (`file.read/list/search/write` tools) and never receive raw `fs`.

### 6. Lightweight versioning + events

Version records (revision, previousHash, currentHash, operationId,
principalId, timestamp) provide mutation provenance and rollback — not a Git
replacement. File events (`file.created/updated/deleted`,
`file.transaction.applied`, `workspace.mounted`, ...) feed Workflow, Agent
context, Activity Room and diagnostics.

## Consequences

- FILE foundation complete: contracts, workspace sandbox, provider port +
  memory/local providers, governed FileService (read/list/search/stat,
  transactions with preview/apply/rollback, versions, events), agent tools,
  control API (`/api/v2/files/*`), capability `files`. 102→114 OpenAPI paths.
- 18 tests (12 unit + 6 integration). ADR-0016.
- FILE-018 (AI file operations), FILE-019 (File Manager UI / reusable explorer),
  S3/Git/remote providers, and File workflow steps follow in later milestones.
