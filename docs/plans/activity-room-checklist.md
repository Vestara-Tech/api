# Activity Room Execution Platform — Implementation Checklist

Grounding:

- [Activity Room docs index](../activity-room/README.md)
- [Activity Room Execution Platform Roadmap](./activity-room-roadmap.md)
- [Verification policy](../engineering/verification-policy.md)
- `vestara-apps/ai/src/pages/ActivityRoomPage.tsx`
- `vestara-apps/ai/src/api/aiApi.ts`
- `src/onboarding/domain/execution.ts`
- `src/onboarding/service/execution-engine.ts`
- `src/onboarding/service/verification.ts`
- `src/car/domain/contracts.ts`
- `src/ai/runtime/model-router.ts`
- `src/generator/service/generation-service.ts`
- `src/generator/preview/preview.ts`
- `src/generator/apply/apply.ts`
- `scripts/verification/graph.ts`
- `scripts/verification/verify.ts`

Status: draft

## Objective

Make Activity Room the human control surface for governed Vestara execution.
The user enters intent, Vestara composes a plan, assigns agents and runtimes,
executes work through governed module boundaries, verifies the result, records
evidence, and returns completion to the same Activity Room view.

## Non-goals

- no separate ARX application
- no unrestricted shell or filesystem access for agents
- no second verification authority
- no direct publication from AI without governed builder/generator paths

## Phase 1 — Execution contract and capability inventory

Goal: lock the execution model and document what already exists before adding
orchestration code.

Files:

- `docs/activity-room/README.md`
- `docs/activity-room/execution-contract.md`
- `docs/activity-room/capability-matrix.md`
- `docs/activity-room/integration-map.md`
- `docs/activity-room/execution-gaps.md`

Add:

- execution invariants for Activity Room
- module/capability matrix for workflow, task, agent, permission, evidence,
  verification, generator, and runtime surfaces
- integration map showing what Activity Room can reuse immediately
- gap register for orchestration-only work

Checklist:

- [ ] inventory current Activity Room entry points and UI boundaries
- [ ] map existing execution-related services to the right owning modules
- [ ] document what Activity Room can reuse without new contracts
- [ ] record the gaps that require new orchestration only
- [ ] lock explicit non-goals and ownership boundaries

Verification:

- [ ] review the checklist against `docs/plans/activity-room-roadmap.md`
- [ ] run `pnpm verify` after the docs are updated

## Phase 2 — Execution domain composition layer

Goal: add the composition layer that ties existing modules together without
replacing their ownership.

Files:

- `src/execution/index.ts`
- `src/execution/contracts.ts`
- `src/execution/domain/execution.ts`
- `src/execution/domain/event.ts`
- `src/execution/domain/lifecycle.ts`
- `src/execution/service/execution-service.ts`
- `src/execution/store/execution-store.ts`
- `src/execution/store/in-memory-execution-store.ts`
- `tests/unit/execution/execution-store.test.ts`
- `tests/unit/execution/execution-service.test.ts`

Add:

- `ExecutionRequest`
- `Execution`
- `ExecutionStatus`
- `ExecutionPlan`
- `ExecutionEvent`
- `ExecutionLease`
- durable execution projection/store for Activity Room

Checklist:

- [ ] represent execution durably
- [ ] compose workflow, task, agent, and evidence state
- [ ] keep resume and rollback semantics explicit
- [ ] expose a read model for Activity Room projections
- [ ] ensure every consequential transition is attributable

Verification:

- [ ] targeted unit tests for the new execution store and service
- [ ] run the smallest applicable `pnpm verify` scope for `src/execution/**`

## Phase 3 — Intent resolution

Goal: turn natural-language user requests into structured execution intents.

Files:

- `src/execution/domain/intent.ts`
- `src/execution/intent-resolver.ts`
- `tests/unit/execution/intent-resolver.test.ts`

Add:

- `ResolvedIntent`
- `IntentAmbiguity`
- intent kinds for `generate`, `build`, `modify`, `fix`, `test`, `verify`,
  `inspect`, and `configure`
- target detection
- confidence scoring
- complexity classification

Checklist:

- [ ] derive intent kind from user language
- [ ] identify the intended target when it is clear
- [ ] surface ambiguities instead of guessing
- [ ] keep outputs deterministic enough for workflow composition

Verification:

- [ ] targeted unit tests for intent resolution
- [ ] run the smallest applicable `pnpm verify` scope for `src/execution/**`

## Phase 4 — Capability resolution and workflow composition

Goal: convert resolved intent into an executable workflow built from real
platform capabilities.

Files:

- `src/execution/capability-resolver.ts`
- `src/execution/domain/workflow-plan.ts`
- `src/execution/workflow-composer.ts`
- `src/workflow/domain/contracts.ts`
- `src/workflow/service/workflow-service.ts`
- `src/task/service/task-service.ts`
- `src/routes/workflow.ts`
- `src/routes/task.ts`
- `tests/unit/execution/workflow-composer.test.ts`

Add:

- capability discovery from installed and enabled modules
- simple, standard, and complex execution profiles
- deterministic milestone/task decomposition
- workflow composition from resolved intent

Checklist:

- [ ] resolve requested capabilities from installed modules
- [ ] compose a workflow plan with milestones and tasks
- [ ] select the smallest execution profile that fits the request
- [ ] keep workflow composition deterministic and test-covered

Verification:

- [ ] targeted unit tests for workflow composition
- [ ] run the smallest applicable `pnpm verify` scope for workflow changes

## Phase 5 — Agent assignment, runtime policy, context, and permissions

Goal: choose who does the work, how they run, what context they receive, and
which actions are allowed.

Files:

- `src/execution/agent-assignment-service.ts`
- `src/execution/context-assembler.ts`
- `src/execution/permission-gate.ts`
- `src/execution/runtime-policy.ts`
- `src/ai/runtime/model-router.ts`
- `src/car/domain/contracts.ts`
- `src/car/runtime/runtime-selector.ts`
- `src/context/service/context-service.ts`
- `src/permission/service/permission-service.ts`
- `src/skill/resolver/skill-resolver.ts`
- `src/tool/runtime/tool-runtime.ts`
- `tests/unit/execution/agent-assignment.test.ts`
- `tests/unit/execution/context-assembler.test.ts`

Add:

- planner/developer/reviewer/verifier assignment
- runtime and provider/model selection
- tool and skill binding
- permission gating for requests and approvals
- assembled execution context rather than wholesale repository dumps

Checklist:

- [ ] assign explicit roles to execution stages
- [ ] keep runtime/model selection separate from agent identity
- [ ] bind only the tools required by the current stage
- [ ] gate consequential actions through the permission module
- [ ] assemble only the context needed for the current task

Verification:

- [ ] targeted unit tests for assignment and context assembly
- [ ] run the smallest applicable `pnpm verify` scope for agent/runtime changes

## Phase 6 — Verification and evidence integration

Goal: connect execution completion to the verification control plane and
evidence bundle.

Files:

- `src/onboarding/domain/execution.ts`
- `src/onboarding/service/execution-engine.ts`
- `src/onboarding/service/verification.ts`
- `scripts/verification/graph.ts`
- `scripts/verification/profile.ts`
- `scripts/verification/verify.ts`
- `tests/unit/execution/verification-integration.test.ts`

Add:

- VCTRL request and result handling
- required evidence selection
- pass/fail/indeterminate propagation
- final execution evidence aggregation

Checklist:

- [ ] block workflow completion until required evidence exists
- [ ] surface verification results in execution state
- [ ] preserve verification provenance in the execution record
- [ ] keep evidence visible to Activity Room projections

Verification:

- [ ] targeted integration tests for verification handoff
- [ ] run the smallest applicable `pnpm verify` scope for verification changes

## Phase 7 — Activity Room projection surface

Goal: make the Activity Room the visible control surface for execution state.

Files:

- `vestara-apps/ai/src/pages/ActivityRoomPage.tsx`
- `vestara-apps/ai/src/api/aiApi.ts`
- `vestara-apps/ai/src/layouts/AiLayout.tsx`
- `vestara-apps/ai/src/app/components/ExecutionTimeline.tsx`
- `vestara-apps/ai/src/app/components/ExecutionInspector.tsx`
- `vestara-apps/ai/src/app/components/ExecutionStatusPill.tsx`
- `vestara-apps/ai/src/app/components/ExecutionPromptBar.tsx`
- `vestara-apps/ai/src/app/components/ExecutionApprovalCard.tsx`
- `vestara-apps/ai/src/app/components/ExecutionEvidencePanel.tsx`
- `vestara-apps/admin/src/pages/ActivityPage.tsx`
- `vestara-apps/admin/src/pages/EvidencePage.tsx`
- `packages/vestara-ui/**` only if reusable execution primitives are justified

Add:

- normalized execution event stream
- workflow/task/agent/approval/evidence projections
- execution inspector and resumable timeline
- approval and evidence visibility in the room

Checklist:

- [ ] keep Activity Room as the primary execution conversation surface
- [ ] project execution state without duplicating business logic
- [ ] show approvals, verification, and evidence inline
- [ ] preserve reload/resume behavior
- [ ] share primitives only when they are clearly reusable

Verification:

- [ ] targeted UI tests for the Activity Room surface
- [ ] run the smallest applicable `pnpm verify` scope for `vestara-apps/ai/**`

## Phase 8 — First vertical slice: generate a TypeScript script

Goal: prove the execution spine with the smallest useful end-to-end task.

Scenario:

> Generate a TypeScript script that does X.

Files:

- `vestara-apps/ai/src/pages/ActivityRoomPage.tsx`
- `src/execution/intent-resolver.ts`
- `src/execution/workflow-composer.ts`
- `src/execution/agent-assignment-service.ts`
- `src/generator/service/generation-service.ts`
- `src/generator/preview/preview.ts`
- `src/generator/apply/apply.ts`
- `src/onboarding/service/execution-engine.ts`
- `src/onboarding/service/verification.ts`
- `scripts/verification/verify.ts`
- `tests/integration/activity-room-generate-script.test.ts`

Add:

- governed generate/preview/apply flow
- VCTRL-driven verification selection
- evidence capture and completion reporting back to the room

Checklist:

- [ ] route the user intent into a governed workflow
- [ ] generate and preview the artifact before any apply step
- [ ] apply only through the governed generator boundary
- [ ] run VCTRL before completion is reported
- [ ] show the resulting evidence in Activity Room

Verification:

- [ ] end-to-end integration test for script generation
- [ ] run the applicable `pnpm verify` scope for the slice

## Phase 9 — Second and third vertical slices

Goal: extend the same spine to higher-value tasks only after the first slice is
reliable.

Scenarios:

- build a reusable UI component
- build the Theme Builder

Files:

- `vestara-apps/ai/src/pages/ActivityRoomPage.tsx`
- `vestara-apps/ai/src/app/components/ExecutionTimeline.tsx`
- `vestara-apps/admin/src/pages/ComponentsPage.tsx`
- `vestara-apps/admin/src/pages/ThemesPage.tsx`
- `src/builder/service/api-definition-service.ts`
- `src/builder/domain/validator.ts`
- `src/generator/service/generation-service.ts`
- `src/generator/templates/template-registry.ts`
- `src/generator/validation/pipeline.ts`
- `tests/integration/activity-room-build-component.test.ts`
- `tests/integration/activity-room-build-theme-builder.test.ts`

Add:

- the same execution model for component work
- the same execution model for complex multi-step builder work
- no parallel execution stack
- no separate ARX app

Checklist:

- [ ] prove the component slice on the existing execution spine
- [ ] prove the Theme Builder slice on the same spine
- [ ] keep admin as the operational surface, not the execution chat surface
- [ ] preserve governed build/preview/apply semantics

Verification:

- [ ] end-to-end integration tests for component and Theme Builder slices
- [ ] run the applicable `pnpm verify` scope for the slice

## Final rule

Each checkpoint must end with:

- implementation complete
- targeted tests complete
- `pnpm verify` or the smallest applicable scoped variant
- evidence recorded

Do not call the roadmap complete until Activity Room can drive at least one
governed end-to-end execution from intent to evidence without manual handoff
between modules.
