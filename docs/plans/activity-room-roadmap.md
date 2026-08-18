# Activity Room Execution Platform Roadmap

Grounding:

- [Verification policy](../engineering/verification-policy.md)
- [Activity Room docs index](../activity-room/README.md)
- [Activity Room implementation checklist](./activity-room-checklist.md)
- `vestara-apps/ai/src/pages/ActivityRoomPage.tsx`
- `src/onboarding/domain/execution.ts`
- `src/onboarding/service/execution-engine.ts`
- `src/onboarding/service/verification.ts`
- `src/car/domain/contracts.ts`
- `src/routes/agents.ts`
- `src/routes/permission.ts`
- `src/routes/task.ts`
- `src/routes/workflow.ts`
- `scripts/verification/verify.ts`
- `scripts/verification/graph.ts`

Status: draft

## Goal

Make Activity Room the human control surface for governed Vestara execution.
The user enters intent, Vestara composes a plan, assigns agents and runtimes,
executes work through governed module boundaries, verifies the result, records
evidence, and returns completion to the same Activity Room view.

The core contract is:

```text
Intent → Plan → Governed Execution → Verification → Evidence → Completion
```

This roadmap is intentionally a composition program. It reuses the existing
execution, workflow, agent, permission, runtime, and verification modules
instead of creating a second source of truth for execution state.

## Current baseline

The repository already has the raw ingredients for ARX:

- Activity Room already exists in the AI app and streams agent activity
- onboarding has a resumable execution engine, checkpoints, rollback, and
  evidence hashing
- agent, skill, and tool registries already exist at the API layer
- permissions already gate sensitive operations
- workflows and tasks already own their own lifecycle APIs
- the coding-agent runtime abstraction already exists
- VCTRL already determines verification scope and evidence

That means ARX should focus on orchestration and projection, not on
re-implementing the underlying modules.

## What ARX is not

- not a new isolated execution engine
- not a shell that gives agents unrestricted platform capabilities
- not an AI chat window with implicit shell access
- not a replacement for workflow, task, agent, permission, or verification
  ownership
- not a second verification authority

## Checkpoint 1 — Execution contract and capability inventory

Goal: lock the execution model before adding orchestration code.

Target files:

- `docs/activity-room/capability-matrix.md`
- `docs/activity-room/execution-gaps.md`
- `docs/activity-room/integration-map.md`
- `docs/activity-room/execution-contract.md`

Scope:

- define the ARX execution invariants
- map existing modules to capabilities, events, approvals, and evidence
- identify where Activity Room can reuse existing contracts directly
- identify the gaps that require new orchestration code

Implementation rules:

- Activity Room renders execution state; it does not own execution state
- intent is never treated as a shell command
- agents never get unrestricted platform capabilities
- verification authority remains with VCTRL

Exit criteria:

- the module/capability map is documented
- execution boundaries are explicit
- no runtime behavior changes yet

## Checkpoint 2 — Execution domain composition layer

Goal: add a composition layer that ties existing modules together without
replacing their ownership.

Target files:

- `src/execution/**`
- `tests/unit/execution/**`

Scope:

- `ExecutionRequest`
- `Execution`
- `ExecutionStatus`
- `ExecutionEvent`
- `ExecutionPlan`
- `ExecutionLease`
- durable execution projection if needed

Implementation rules:

- this layer composes workflow, task, onboarding, agent, and evidence state
- it does not become a new business-logic source of truth
- resumability and rollback remain explicit
- every consequential action is attributable

Exit criteria:

- an execution can be represented and resumed from durable state
- the execution model can reference workflow/task/agent state
- the model survives browser/session loss

## Checkpoint 3 — Intent resolution

Goal: turn natural-language user requests into structured work intents.

Target files:

- `src/execution/intent-resolver.ts`
- `tests/unit/execution/intent-resolver.test.ts`

Scope:

- `ResolvedIntent`
- `IntentAmbiguity`
- intent kinds such as `generate`, `build`, `modify`, `fix`, `test`,
  `verify`, `inspect`, `configure`
- target detection
- confidence scoring
- complexity classification

Implementation rules:

- AI may help interpret intent, but it does not invent capability names
- the resolver must produce explicit ambiguities when the request is unclear
- the resolver must stay grounded in real Vestara targets

Exit criteria:

- “Build the Theme Builder” resolves to a structured intent
- ambiguities are surfaced explicitly
- the output is stable enough to feed workflow composition

## Checkpoint 4 — Capability resolution and workflow composition

Goal: convert resolved intent into an executable workflow built from real
platform capabilities.

Target files:

- `src/execution/capability-resolver.ts`
- `src/execution/workflow-composer.ts`
- `src/workflow/**`
- `src/routes/workflow.ts`
- `src/routes/task.ts`
- `tests/unit/execution/workflow-composer.test.ts`

Scope:

- inspect installed/enabled module capabilities
- produce an executable workflow
- decompose work into milestones and tasks
- select the simplest execution profile that fits the request

Implementation rules:

- profiles should stay small when the work is small
- the workflow composer must use real module capabilities, not invented names
- marketplace-installed capabilities should be discoverable without code
  changes

Exit criteria:

- a resolved intent can become a governed workflow
- simple, standard, and complex profiles are distinguishable
- workflow composition is deterministic and test-covered

## Checkpoint 5 — Agent assignment, runtime policy, context, and permissions

Goal: choose who does the work, how they run, what context they receive, and
which actions are allowed.

Target files:

- `src/car/**`
- `src/ai/**`
- `src/context/**`
- `src/permission/**`
- `src/skill/**`
- `src/tool/**`
- `tests/unit/execution/agent-assignment.test.ts`
- `tests/unit/execution/context-assembler.test.ts`

Scope:

- `AgentAssignmentService`
- `ExecutionContextAssembler`
- `ModelRouter`
- `CodingAgentRuntime` selection
- tool binding
- skill binding
- permission gate for requests and approvals

Implementation rules:

- coding runtimes are adapters, not agents
- permissions decide whether an action is allowed or approval-required
- context is assembled, not dumped wholesale
- dangerous operations must stay governable in Activity Room

Exit criteria:

- an execution can be assigned to planner/developer/reviewer/verifier roles
- runtime/model selection is explicit
- tool and permission boundaries are enforced

## Checkpoint 6 — Verification and evidence integration

Goal: connect execution completion to the verification control plane and
evidence bundle.

Target files:

- `scripts/verification/**`
- `src/onboarding/service/verification.ts`
- `src/routes/onboarding-v2.ts`
- `tests/unit/execution/verification-integration.test.ts`

Scope:

- VCTRL requests and result handling
- required evidence selection
- verification pass/fail/indeterminate propagation
- final execution evidence aggregation

Implementation rules:

- ARX requests verification; VCTRL decides sufficient verification
- workflow completion requires required evidence
- evidence is recorded before completion is reported

Exit criteria:

- execution completion is blocked until required evidence exists
- verification results are surfaced in execution state
- evidence provenance is visible in the Activity Room flow

## Checkpoint 7 — Activity Room projection surface

Goal: make the Activity Room the visible control surface for execution state.

Target files:

- `vestara-apps/ai/src/pages/ActivityRoomPage.tsx`
- `vestara-apps/ai/src/api/aiApi.ts`
- `vestara-apps/ai/src/components/**`
- `packages/vestara-ui/**` if shared execution UI primitives are justified
- `vestara-apps/admin/**` only for operational projections that belong in Admin

Scope:

- normalized execution event stream
- workflow/task/agent/approval/evidence projections
- execution inspector
- resumable activity timeline
- compact first-pass UI for the execution spine

Implementation rules:

- keep the current Activity Room page as the first integration surface
- do not create a separate ARX app
- share primitives only when they are clearly reusable
- keep admin as the operational surface, not the execution conversation surface

Exit criteria:

- Activity Room shows execution state end-to-end
- the room can be reloaded without losing the execution
- the UI makes approvals, verification, and evidence visible

## Checkpoint 8 — First vertical slice: generate a TypeScript script

Goal: prove the execution spine with the smallest useful end-to-end task.

Scenario:

> Generate a TypeScript script that does X.

Flow:

```text
Activity Room
  ↓
Intent Resolver
  ↓
Workflow Composer
  ↓
Developer Agent
  ↓
Coding Runtime
  ↓
Generator / Preview / Apply
  ↓
VCTRL
  ↓
Evidence
  ↓
Completion
```

Exit criteria:

- the request can be handled end-to-end from Activity Room
- the generated change is governed and verified
- evidence is captured and visible in the same room

## Checkpoint 9 — Second and third vertical slices

Goal: extend the same spine to higher-value tasks only after the first slice is
reliable.

Scenarios:

- build a reusable UI component
- build the Theme Builder

Exit criteria:

- the same execution model supports component work
- the same execution model supports a complex multi-step builder task
- no parallel execution stack is introduced

## Verification rule

Each checkpoint must end with:

- implementation complete
- targeted tests complete
- `pnpm verify` or the applicable scoped variant
- evidence recorded

Do not call the roadmap complete until the Activity Room can drive at least
one governed end-to-end execution from intent to evidence without manual
handoff between modules.
