# Repository Verification Policy

Canonical specification for incremental, impact-based verification in this
repository. Enforced for agents by `AGENTS.md` and implemented by the
verification engine in `scripts/verification/`.

- Package manager: pnpm (canonical). The engine detects the package manager
  from the lockfile; do not assume npm/pnpm interchangeability.
- Entrypoint: `pnpm verify` (default scope: affected)
- Test runner: Vitest, one-shot `run` mode only (`pnpm exec vitest run`)
- Configuration: `.vestara/verification.json`
- Generated artifacts (gitignored): `.vestara/evidence/`, `.vestara/cache/`

---

## 1. Purpose

Full-suite verification after every implementation step is slow, noisy, and
does not scale. This policy replaces it with incremental, impact-based
verification powered by an explicit module graph, deterministic fingerprints,
and a reusable evidence cache.

## 2. Core Rule

> Run the smallest verification scope capable of invalidating the current
> change.

Do not repeatedly run the full repository test suite after individual
implementation tasks. Never rerun passing tests when valid evidence exists for
the same fingerprint.

## 3. Verification Levels

| Level | Scope | Command | What runs |
| ----- | ----- | ------- | --------- |
| V0 | Static | `pnpm verify:static` | `tsc -p tsconfig.json` (typechecks src, tests, and the verification engine itself) |
| V1 | Affected | `pnpm verify:affected` | Directly affected and transitively impacted tests from the module graph |
| V2 | Module | `pnpm verify:module -- <name>` | The complete test scope of the affected module(s) |
| V3 | Platform | `pnpm verify:platform` | Static + the full repository test suite |

The default scope is `affected` (V1). `pnpm verify` is equivalent to
`pnpm verify:affected`.

## 4. Verification Pipeline

```
pnpm verify
    ↓
Git change detection        scripts/verification/affected.ts
    ↓
Impact analysis             scripts/verification/impact.ts
  explicit module graph → transitive closure → contract/shared classification
    ↓
Verification level          V0/V1/V2/V3 + escalation rules
    ↓
Fingerprint                 scripts/verification/fingerprint.ts (SHA256)
    ↓
Evidence lookup             .vestara/evidence/verification/
    ├── reusable PASS → CACHED (no process started)
    └── miss → execute via Turborepo (workspace tasks) or Vitest (API tests)
                   ↓
             persist evidence
    ↓
Verification report         .vestara/evidence/verification/latest.json
    ↓
Performance telemetry       .vestara/evidence/telemetry/verification.jsonl
```

Two engines with distinct responsibilities:

```text
FASTVERIFY  — "What actually needs verification?"
  changed files → module graph → contract/risk classification → level → evidence
Turborepo   — "What work can be skipped/reused?"
  package dependency graph → task scheduling → input hashing → local cache
```

FASTVERIFY selects and evidences verification; Turborepo executes and caches
deterministic workspace tasks. FASTVERIFY does not build a second task-output
cache — Turbo owns that problem.

## 5. Change Detection

`gitChangedFiles()` collects the changed file set from:

- commits on the current branch since the merge-base with `origin/main`
  (falls back to `HEAD` when `origin/main` does not exist);
- staged changes, unstaged working-tree changes;
- untracked non-ignored files.

Each file is classified as: trigger, tooling (`scripts/verification/`),
contract (`contracts/`), source (`src/`), test, docs, or other.

## 6. Impact Analysis (FASTVERIFY-007/008)

The module graph in `.vestara/verification.json` maps source globs to test
globs and declares inter-module dependencies:

```json
"onboarding": {
  "sources": ["src/onboarding/**"],
  "tests": ["tests/unit/onboarding*.test.ts", "tests/integration/onboarding-api.test.ts"],
  "dependsOn": ["core", "capabilities", "configuration", "generator", "auth", "bootstrap", "ai"]
}
```

`computeImpact()` produces:

```ts
interface VerificationImpact {
  changedFiles: string[];
  directlyAffectedModules: string[];
  transitivelyAffectedModules: string[];
  selectedTests: string[];
  level: "V0" | "V1" | "V2" | "V3";
  reasons: string[];
  contractChanges: string[];
  unknownSources: string[];
  uncoveredModules: string[];
  sharedImpact: boolean;
}
```

Resolution order:

1. **Explicit map** — the primary mechanism.
2. **Convention fallback** — base-name / path-segment matching against test
   filenames.
3. **Escalation** — never silently skip. Unknown sources escalate to V2;
   shared infrastructure (`src/core`, `src/bootstrap`, `src/plugins`,
   `src/types`) escalates to V3.

### Transitive dependency analysis

If `auth` depends on `configuration` and `onboarding` depends on `auth`, then a
change to `configuration` selects configuration tests plus auth and onboarding
tests. The engine distinguishes:

- **Implementation change** — module tests + dependents' tests (V1).
- **Contract change** — matches `contractPatterns` (`contracts/**`,
  `src/routes/**`, `*.schema.ts`, `*.types.ts`): at least V2, and all
  dependent module tests are selected.
- **Shared infrastructure change** — `sharedModules`: V3 platform.

### Test coverage honesty

The engine reports `uncoveredModules` (mapped modules with no resolvable
tests) and `unknownSources`. It never translates "no tests exist" into
"verified": when nothing executes, the report sets `verified: false`, no
reusable evidence is stored, and agents must describe the run as static-only.

## 7. Verification Fingerprint (FASTVERIFY-009)

A deterministic SHA256 over:

- engine version and engine source (`scripts/verification/**`);
- toolchain (node version, platform);
- dependency/config files (package manifests, lockfile, tsconfigs,
  vitest config, verification config);
- the source files under verification;
- the selected tests;
- the level and scope of the run.

Deterministic by construction: sorted file lists, stable separators, no
timestamps. Identical inputs always produce identical fingerprints; changing
any input changes the fingerprint and invalidates the evidence.

## 8. Evidence Cache and Execution (FASTVERIFY-010/011)

- **Evidence** (`sha256-<hex>.json`): fingerprint, level, scope, modules,
  tests, `result`, `durationMs`, `createdAt`, toolchain. Stored under
  `.vestara/evidence/verification/`.
- **Reuse rule**: a previous `pass` evidence for the same fingerprint is
  reused without starting any process. Failed evidence is never reused as PASS.
- **Forcing execution**: `--no-cache`.

Expected output when caching:

```text
Evidence: 4 cached (sha256:85e4d7...)
CACHED PASS
Executed  0
Cached    4
```

## 9. Verification Report (FASTVERIFY-012)

Every invocation writes a machine-readable report to
`.vestara/evidence/verification/latest.json` and prints a human-readable
summary generated from the same report:

```ts
interface VerificationReport {
  version: 1;
  level: string;
  scope: string;
  changedFiles: string[];
  affectedModules: string[];
  selectedTests: string[];
  executedTests: string[];
  reusedTests: string[];
  skippedTests: string[];
  passed: number;
  failed: number;
  cached: number;
  escalated: boolean;
  escalationReasons: string[];
  durationMs: number;
  result: "pass" | "fail";
  verified: boolean;
  evidence: string | null;
}
```

`--json` prints the full report; CI publishes `latest.json` as an artifact.

## 10. Agent Completion Contract (FASTVERIFY-013)

Agents must report the evidence record produced by `pnpm verify`, including
level, impact modules, selected/executed/cached counts, result, duration,
and the fingerprint. Agents must not rerun tests merely to produce their own
claim when valid evidence exists for the same fingerprint — Developer,
Reviewer, and Verifier workflows reuse the same evidence:

```text
Developer → PASS <fingerprint>
Reviewer  → inputs unchanged → reuse <fingerprint>
Verifier  → independent impact analysis → <fingerprint> sufficient → reuse
```

## 11. Performance Telemetry (FASTVERIFY-015)

Every run appends one JSON line to
`.vestara/evidence/telemetry/verification.jsonl`. `pnpm verify:telemetry`
aggregates: runs, tests selected/executed/cached, cache hit rate, escalation
frequency, passes/failures, and average duration. Track these over time to
decide whether the impact analysis and cache justify their maintenance cost.

## 12. CI (FASTVERIFY-014)

CI uses the same engine — there is not one policy for agents and another for
CI (see `.github/workflows/verification.yml`):

| Context | Command |
| ------- | ------- |
| Pull request | `pnpm verify:affected` |
| main / integration | `pnpm verify:platform` |
| Release | `pnpm build` + `pnpm verify:platform` |

CI publishes `latest.json` as an artifact.

## 13. Prohibited and Preferred Commands

| | Command | Why |
| --- | --- | --- |
| DO NOT | `pnpm test` after every task | Full suite after each step is the anti-pattern this policy replaces. |
| DO NOT | `vitest` without `run` | Watch mode does not terminate in autonomous execution. |
| DO NOT | `... \| tail` on long-running verification | Hides progress; long-running/watch processes can appear hung. |
| DO NOT | rerun passing tests without relevant changes | Violates evidence reuse. |
| DO NOT | the full suite "just to be safe" after every step | Escalation rules define when it is required. |
| PREFER | `pnpm verify` | Default affected scope. |
| PREFER | `pnpm exec vitest run <files>` | Deterministic one-shot execution of specific files. |
| PREFER | `pnpm verify:module -- <name>` | Module scope when escalation requires it. |
| PREFER | `pnpm verify:platform` | Full suite, only when escalation requires it. |

## 14. Configuration Reference

`.vestara/verification.json`:

| Key | Meaning |
| --- | ------- |
| `defaultLevel` | Scope used when invoked without a level. |
| `fullVerificationTriggers` | Paths whose modification forces V3. |
| `contractPatterns` | Path patterns treated as contract changes. |
| `sharedModules` | Modules whose changes select the full suite (V3). |
| `modules` | Explicit module map: sources, tests, dependsOn. |
| `neverWatch` / `reuseEvidence` / `escalateOnUnknownImpact` | Engine behavior flags. |

## 15. Design Constraints

- Keep the engine repository-local for now. It is the second reference
  implementation of the eventual reusable Vestara verification package; do not
  extract shared code until a second repository has proven the same contracts.
- Do not create artificial tests to populate the module graph. Map existing
  modules and add tests naturally as implementation work touches them.
- Only successful verification is reusable. A failed result is evidence, but
  it is not a reusable PASS.

## 16. Turborepo Integration

Turborepo (`turbo.json`, root scripts) is the workspace execution/cache layer
for `packages/*` and `vestara-apps/*`. The API root package is a pure
orchestrator and is not a turbo task target; its own build/test run directly
(`pnpm build:api`, `pnpm test:api`) and its verification flows through
FASTVERIFY (`pnpm verify*`).

### Task graph

| Task | Command | Notes |
| ---- | ------- | ----- |
| `build` | `turbo run build` / `pnpm build` | `dependsOn: ^build`, outputs `dist/**` |
| `typecheck` | `turbo run typecheck` / `pnpm typecheck` | `dependsOn: ^typecheck` |
| `lint` | `turbo run lint` / `pnpm lint` | `outputs: []` |
| `test` | `turbo run test` / `pnpm test` | `dependsOn: ^build` |
| `dev` | `turbo run dev` | `cache: false`, `persistent: true` |
| affected | `turbo run build --affected` / `test --affected` | git-diff based |

Turbo owns package-level dependency impact (`@vestara/ui` changed → Admin
depends on it). FASTVERIFY adds the semantic information Turbo cannot know:
file → module → contract → risk → verification level → evidence.

### Cacheability classification

Turbo caching is acceptable evidence only for deterministic tasks:

- CACHEABLE: TypeScript, lint, unit tests, pure contract tests, generator
  determinism, frontend builds, static validation, component render tests.
- NON-CACHEABLE (configure `cache: false`, or never cite a cache hit as
  evidence): live API health, database connectivity, system services,
  hardware, firmware, network, OAuth, external AI providers, live browser
  integration, OS boot verification, time-sensitive diagnostics.

A cached result saying firmware state was healthy yesterday is not evidence
that the machine is healthy now. A Turbo cache hit is never evidence for
live system state, external service availability, firmware state, or network
state.

### Local cache first

Local caching (`node_modules/.cache/turbo`, `.turbo/`) is the starting point.
Remote caching across developers/CI/worktrees is a later step and is not a
prerequisite. Content-addressed caching means identical deterministic tasks
do not have to be recomputed merely because a different agent (Planner,
Developer, Reviewer, Verifier) requested them across branches/worktrees.

### Roadmap status

- TURBO-001 Turborepo — done
- TURBO-002 Workspace task graph — done
- TURBO-003 Build caching — done
- TURBO-004 Typecheck caching — done
- TURBO-005 Unit-test caching — done
- TURBO-006 Affected package execution — done
- FASTVERIFY-010 Turbo result/evidence adapter — follow-up (record turbo cache
  provenance in FASTVERIFY evidence; classify task cacheability)
- Remote cache + CI cache sharing — follow-up after the local workflow proves
  stable