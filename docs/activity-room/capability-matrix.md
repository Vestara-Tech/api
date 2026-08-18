# Activity Room Capability Matrix

Status: draft

This matrix records the current ownership of execution-related capabilities and
what ARX still needs to compose.

| Domain | Current code | Current role | ARX next use |
| --- | --- | --- | --- |
| Activity Room | `vestara-apps/ai/src/pages/ActivityRoomPage.tsx` | streams agent activity and accepts goals | primary execution conversation surface |
| Execution state | `src/onboarding/domain/execution.ts` | resumable checkpoints, rollback, evidence hash | durable execution projection |
| Execution engine | `src/onboarding/service/execution-engine.ts` | step execution and lifecycle coordination | composition layer for orchestrated work |
| Verification pipeline | `src/onboarding/service/verification.ts` | verifies completed execution state | VCTRL handoff and evidence gate |
| AI runtime routing | `src/ai/runtime/model-router.ts` | provider/model selection | execution-stage runtime selection |
| Coding runtime | `src/car/domain/contracts.ts` | coding agent runtime abstraction | developer-agent runtime binding |
| Agent runtime | `src/agent/runtime/agent-runtime.ts` | agent execution loop | planner/developer/reviewer/verifier roles |
| Context assembly | `src/context/service/context-service.ts` | context collection and snapshotting | scoped execution context assembly |
| Permissions | `src/permission/service/permission-service.ts` | approval and policy decisions | governed apply and dangerous-action gating |
| Skills | `src/skill/resolver/skill-resolver.ts` | skill lookup and selection | execution-stage skill binding |
| Tools | `src/tool/runtime/tool-runtime.ts` | tool execution boundary | scoped tool access for agents |
| Workflow | `src/workflow/service/workflow-service.ts` | workflow lifecycle | executable workflow composition |
| Tasks | `src/task/service/task-service.ts` | task lifecycle | workflow decomposition and progress tracking |
| Execution composition | `src/execution/**` | intent resolution, capability resolution, durable execution drafts | governed Activity Room preview and recovery projection |
| Generator | `src/generator/service/generation-service.ts` | generate / preview / apply orchestration | vertical-slice artifact creation |
| Preview | `src/generator/preview/preview.ts` | diff artifact set against target | approval preview for apply |
| Governed apply | `src/generator/apply/apply.ts` | only approved filesystem mutation path | controlled artifact publication |
| VCTRL | `scripts/verification/verify.ts`, `scripts/verification/graph.ts` | verification scope and evidence authority | required verification and proof |
| Admin projections | `vestara-apps/admin/src/pages/ActivityPage.tsx`, `vestara-apps/admin/src/pages/EvidencePage.tsx` | operational visibility | control-plane projection, not conversation surface |

## What is missing

- richer intent coverage and ambiguity handling for more ARX goal types
- a stable execution event stream for projections into Activity Room
- a reusable execution inspector / timeline / approval surface
- explicit ARX vertical slices from intent to evidence
