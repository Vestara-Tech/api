# Documentation and GitHub Automation Roadmap

Grounding:

- [Verification policy](../engineering/verification-policy.md)
- `pnpm verify:affected`
- `pnpm openapi:generate`
- `pnpm contracts:frontend`
- existing GitHub Actions workflow in `.github/workflows/verification.yml`

Status: implemented

## Goal

Automate documentation updates first, then automate the commit and GitHub push
of the resulting change set.

The automation should keep the repository in a verified state and must not
push unverified changes.

## Implementation status

The repository now contains the full documentation automation chain:

- `docs:sync` / `docs:check`
- `docs:verify`
- `docs:commit` / `docs:push` / `docs:ship`
- `docs-sync.yml` CI enforcement
- generated platform summary + README sync block
- verification-gated commit and push orchestration

## Current baseline

The repository already has several pieces of the pipeline:

- OpenAPI generation and drift checking
- frontend contract generation and drift checking
- verification policy with affected-scope selection
- GitHub Actions validation on push / pull request / release tags
- a large docs surface (`docs/adr`, `docs/plans`, `docs/engineering`,
  `README.md`)

That orchestrated flow is:

1. detects documentation drift
2. updates generated documentation
3. verifies the repository
4. creates a commit
5. pushes to GitHub
6. optionally opens a draft PR

The implementation in this repository now covers that flow end to end via:

- `pnpm docs:sync`
- `pnpm docs:check`
- `pnpm docs:commit`
- `pnpm docs:push`
- `pnpm docs:ship`
- `.github/workflows/docs-sync.yml`

## Documentation classes

Treat documentation as three different classes so automation stays bounded.

### 1. Generated documentation

Documentation that should be regenerated from source of truth:

- OpenAPI
- frontend contracts
- capability summaries
- registry tables
- generated README sections

### 2. Assisted documentation

Documentation that can be draft-updated by automation but still needs review:

- ADRs
- implementation plans
- roadmap documents
- release notes

### 3. Curated documentation

Documentation that should generally be edited intentionally, with automation
limited to index updates and drift detection:

- engineering policy
- manual design notes
- architectural decision summaries

## Checkpoint 1 — Documentation ownership map

Create a documentation manifest that maps each doc area to:

- source of truth
- update command
- review requirement
- verification command
- publish command

Suggested target:

- `docs/automation/documentation-map.md`

This manifest should answer:

- which docs are generated
- which docs are assisted
- which docs remain curated
- which commands update each class

Exit criteria:

- every major doc area has an owner and update path
- generated vs curated docs are explicitly separated
- no behavior changes yet

## Checkpoint 2 — Documentation sync engine

Add a single script that updates generated documentation from repository
sources.

Suggested target:

- `scripts/docs/sync.ts`

Suggested responsibilities:

- regenerate OpenAPI
- regenerate frontend contracts
- refresh generated README sections
- refresh capability/module summary tables
- detect stale generated docs and report them clearly

The script should support:

- `--write`
- `--check`
- `--dry-run`
- `--targets <list>`

Implementation rules:

- generated docs must be deterministic
- generated docs must not depend on local editor state
- the script should fail on drift in `--check` mode

Exit criteria:

- a single command can refresh generated docs
- a clean tree stays clean after regeneration
- drift is reported as actionable output

## Checkpoint 3 — Documentation verification gate

Extend the existing verification flow so documentation updates are validated
before any git action.

The gate should include:

- `pnpm verify:affected`
- `pnpm openapi:check`
- `pnpm contracts:frontend:check`
- any docs-specific checks added later

Implementation rules:

- verification must run before commit creation
- failing docs checks abort the automation
- verification evidence must be recorded before any push

Exit criteria:

- docs drift cannot be committed without verification
- verification output is part of the automation evidence

## Checkpoint 4 — Commit orchestration

Add a script that stages the verified documentation change set and creates a
git commit.

Suggested target:

- `scripts/git/commit-docs.ts`

Responsibilities:

- stage only approved paths
- create a deterministic commit message
- include a verification summary in the commit body
- refuse to commit if the tree is dirty in unexpected ways
- refuse to commit if verification failed

Recommended commit message shapes:

- `docs: refresh generated documentation`
- `docs(scope): sync OpenAPI and frontend contracts`
- `docs(adr): update roadmap and decision records`

Implementation rules:

- no force push semantics
- no hidden staging of unrelated files
- no commit without an explicit verification pass

Exit criteria:

- verified docs changes can be committed repeatably
- commit metadata records what was updated and why

## Checkpoint 5 — Push orchestration

Add a push step that sends the verified commit to GitHub.

Suggested target:

- `scripts/git/push-docs.ts`

Responsibilities:

- push the current branch to the configured remote
- refuse to push if the commit is missing or verification failed
- avoid force pushes
- optionally create or update a draft PR after push

Implementation rules:

- protected branches should not be pushed to directly unless explicitly
  configured
- the push step should be separable from commit creation
- push output should record the branch and commit SHA

Exit criteria:

- verified commits can be pushed to GitHub
- branch/commit traceability is preserved

## Checkpoint 6 — End-to-end ship command

Add one orchestration command that handles the full flow.

Suggested target:

- `pnpm docs:ship`

Pipeline:

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

Recommended flags:

- `--dry-run`
- `--check`
- `--message`
- `--branch`
- `--no-push`
- `--pr`

Exit criteria:

- one command can move documentation changes from source edits to GitHub
- dry-run mode shows exactly what would happen
- the command refuses to push unverified changes

## Checkpoint 7 — GitHub workflow enforcement

Add or extend GitHub Actions so the repository keeps enforcing the same rules
in CI.

The workflow should:

- verify docs drift on pull requests
- verify generated docs on pushes to main
- publish verification evidence
- reject changes that bypass the local automation path

Suggested target:

- `.github/workflows/docs-sync.yml`

Implemented in this repository:

- `.github/workflows/docs-sync.yml`

Exit criteria:

- CI and local automation enforce the same policy
- docs drift is visible before merge

## Safety rules

- Do not auto-push unverified changes
- Do not silently rewrite curated docs
- Do not use force push
- Do not commit secrets or environment-specific material
- Do not treat generated docs as evidence unless verification passed
- Do not auto-open a PR until the commit is verified and pushed

## Recommended implementation order

1. documentation ownership map
2. documentation sync engine
3. docs verification gate
4. commit orchestration
5. push orchestration
6. end-to-end ship command
7. GitHub workflow enforcement

## Definition of done

The automation is complete only when:

- docs can be regenerated from source of truth
- the repository verifies before commit
- the commit is created automatically
- the commit is pushed automatically
- optional PR creation is supported
- CI enforces the same policy
