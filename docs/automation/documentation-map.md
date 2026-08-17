# Documentation Ownership Map

Status: draft

This document defines which documentation is generated, which is assisted,
and which is curated. The purpose is to make documentation automation
deterministic before any commit/push orchestration is added.

## Rules

- Generated docs must be reproducible from source of truth.
- Assisted docs may be draft-updated by automation, but require human review.
- Curated docs should only be updated intentionally.
- No documentation change should be committed or pushed before verification.

## Generated documentation

These documents are expected to be refreshed from source.

| Document | Source of truth | Update command | Check command | Review |
|---|---|---|---|---|
| `contracts/openapi/vestara-api-v2.json` | `src/routes/*`, route schemas, bootstrap capability wiring | `pnpm openapi:generate` | `pnpm openapi:check` | Required for contract changes |
| Frontend contract types under the workspace/client packages | backend OpenAPI + frontend contract generator inputs | `pnpm contracts:frontend` | `pnpm contracts:frontend:check` | Required for contract changes |
| Capability summaries in docs/README sections | capability registry, module bootstrap, package manifests | `pnpm docs:sync` | `pnpm docs:check` | Required |
| Generated API/module summary tables | source modules and capability registry | `pnpm docs:sync` | `pnpm docs:check` | Required |

## Assisted documentation

These documents may be updated with automation assistance, but a human must
review the result before merge or publish.

| Document | Source of truth | Automation role | Review |
|---|---|---|---|
| `docs/adr/*.md` | architecture decisions and implementation changes | draft updates, cross-link suggestions, summary extraction | Required |
| `docs/plans/*.md` | current implementation direction and sequencing | draft updates from roadmap changes | Required |
| `README.md` narrative sections | current platform status and module summaries | regenerate or patch affected sections | Required |
| Release notes / changelog files if added later | merged change set and verification evidence | draft release summaries | Required |

## Curated documentation

These documents are policy or long-lived guidance. Automation may update
indexes or cross-links, but the content itself should remain deliberate.

| Document | Source of truth | Automation role | Review |
|---|---|---|---|
| `docs/engineering/verification-policy.md` | verification engine behavior and policy decisions | index/cross-link updates only | Required |
| `AGENTS.md` | repo-specific operating instructions | explicit edits only | Required |
| workflow files under `.github/workflows/*.yml` | CI design and repository operations | explicit edits only | Required |

## Documentation update flow

The intended automation flow is:

```text
source changes
  ↓
sync generated docs
  ↓
check generated docs
  ↓
verify repository
  ↓
commit verified changes
  ↓
push to GitHub
```

## Commands in the documentation automation path

These commands are part of the current update/verification flow:

- `pnpm openapi:generate`
- `pnpm openapi:check`
- `pnpm contracts:frontend`
- `pnpm contracts:frontend:check`
- `pnpm verify:affected`
- `pnpm verify:static`
- `pnpm docs:sync`
- `pnpm docs:check`
- `pnpm docs:verify`
- `pnpm docs:commit`
- `pnpm docs:push`
- `pnpm docs:ship`

## Ownership by area

### API and contract documentation

Owner:

- route modules
- bootstrap capability wiring
- OpenAPI generator

Primary docs:

- OpenAPI JSON
- frontend contract types
- API-facing ADRs

### Platform and architecture documentation

Owner:

- module ADRs
- implementation plans
- engineering policy docs

Primary docs:

- `docs/adr/*.md`
- `docs/plans/*.md`
- `docs/engineering/*.md`

### Operational and release documentation

Owner:

- verification engine
- GitHub automation
- release flow

Primary docs:

- verification policy
- GitHub workflow definitions
- future release notes

## Default review policy

- Generated docs: review after regeneration, before commit.
- Assisted docs: review after drafting, before merge.
- Curated docs: edit intentionally, then review.

## Acceptance criteria for this map

- Every major documentation area is classified.
- Every generated doc has a source of truth and update command.
- No doc is implicitly editable by automation without a review step.
- The map can drive the future docs sync script.
