# Documentation and GitHub Automation — Implementation Checklist

Grounding:

- [Documentation and GitHub Automation Roadmap](./documentation-and-github-automation-roadmap.md)
- [Verification policy](../engineering/verification-policy.md)

Status: implemented

## Objective

Automate documentation updates first, then automate verified commit + push to
GitHub.

The implementation must preserve the repository rule:

`update docs → verify → commit → push`

Never the reverse.

This checklist now reflects the implementation that exists in the repository.

## Phase 0 — Define the documentation contract

Goal: make doc ownership explicit before adding automation.

Add:

- `docs/automation/documentation-map.md`

Checklist:

- [x] classify docs into generated / assisted / curated
- [x] assign a source of truth for each doc class
- [x] assign a verification command for each generated doc class
- [x] record which docs are safe to update automatically
- [x] record which docs require human review

Verification:

- [x] docs map is reviewed and accepted
- [x] no source behavior changes

## Phase 1 — Add doc sync commands

Goal: one command updates generated documentation from source.

Add:

- `scripts/docs/sync.ts`
- `scripts/docs/check.ts`

Add package scripts:

- `docs:sync`
- `docs:check`
- `docs:verify`

Suggested behavior:

- `docs:sync` writes generated docs
- `docs:check` fails on drift without writing

Checklist:

- [x] regenerate OpenAPI from source
- [x] regenerate frontend contracts from source
- [x] refresh generated README sections
- [x] refresh capability/module summary tables
- [x] keep output deterministic

Verification:

- [x] `pnpm openapi:generate`
- [x] `pnpm contracts:frontend`
- [x] `pnpm openapi:check`
- [x] `pnpm contracts:frontend:check`

## Phase 2 — Add a single docs verification gate

Goal: make documentation a first-class part of the existing verification flow.

Update:

- `scripts/verification/verify.ts`
- `scripts/verification/affected.ts` if docs-specific selection needs refinement
- `docs/engineering/verification-policy.md` if the policy wording needs a docs section

Checklist:

- [x] docs drift is detected before commit
- [x] docs verification runs before git actions
- [x] docs verification output is stored with the run
- [x] docs-only changes do not bypass verification

Verification:

- [x] `pnpm verify:affected`
- [x] `pnpm verify:static` if static checks changed

## Phase 3 — Add commit automation

Goal: stage verified doc changes and create a commit automatically.

Add:

- `scripts/git/commit-docs.ts`

Add package scripts:

- `docs:commit`

Checklist:

- [x] stage only approved paths
- [x] refuse to commit if verification failed
- [x] refuse to commit if unexpected files changed
- [x] create a deterministic commit message
- [x] include verification summary in commit body

Recommended commit message format:

- `docs: refresh generated documentation`
- `docs(scope): sync OpenAPI and frontend contracts`
- `docs(plan): update implementation checklist`

Verification:

- [x] commit is created only from verified changes
- [x] commit body records the verification fingerprint

## Phase 4 — Add push automation

Goal: push the verified commit to the configured GitHub remote.

Add:

- `scripts/git/push-docs.ts`

Add package scripts:

- `docs:push`

Checklist:

- [x] refuse to push without a verified commit
- [x] refuse to force push
- [x] record branch and commit SHA
- [x] support draft PR creation only after push

Verification:

- [x] push succeeds on a verified commit
- [x] protected branches are not bypassed

## Phase 5 — Add the end-to-end ship command

Goal: one command handles the whole flow.

Add:

- `scripts/docs/ship.ts`

Add package scripts:

- `docs:ship`

Suggested pipeline:

```text
detect drift
  ↓
sync docs
  ↓
verify
  ↓
commit
  ↓
push
  ↓
optional draft PR
```

Checklist:

- [x] `--dry-run` supported
- [x] `--check` supported
- [x] `--message` supported
- [x] `--branch` supported
- [x] `--no-push` supported
- [x] `--pr` supported

Verification:

- [x] dry-run prints every action it would take
- [x] ship refuses to push unverified changes

## Phase 6 — Add GitHub Actions enforcement

Goal: CI enforces the same docs rules.

Add or update:

- `.github/workflows/docs-sync.yml`
- `.github/workflows/verification.yml` if docs checks should be folded in

Checklist:

- [x] docs drift checked on pull requests
- [x] generated docs checked on push to main
- [x] verification evidence published
- [x] drift failure is clear and actionable

Verification:

- [x] CI and local automation agree on the same checks

## Implemented files

- `docs/automation/documentation-map.md`
- `scripts/docs/sync.ts`
- `scripts/docs/check.ts`
- `scripts/git/commit-docs.ts`
- `scripts/git/push-docs.ts`
- `scripts/docs/ship.ts`
- `docs/plans/documentation-and-github-automation-roadmap.md`
- `.github/workflows/docs-sync.yml`

## Implemented package scripts

- `docs:sync`
- `docs:check`
- `docs:verify`
- `docs:commit`
- `docs:push`
- `docs:ship`

## Guardrails

- Never push unverified documentation changes.
- Never force push.
- Never stage unrelated files.
- Never treat generated docs as evidence without verification.
- Never auto-open a PR before commit and push succeed.

## Completion rule

This checklist is complete only when:

- generated docs can be refreshed from source
- verification runs before commit/push
- commit creation is automated
- GitHub push is automated
- CI enforces the same policy
