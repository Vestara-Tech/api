# Activity Room Integration Map

Status: draft

This map shows how a user intent should flow through Vestara once ARX is
complete.

```text
User intent
  ↓
Activity Room
  ↓
Intent resolver
  ↓
Capability resolver
  ↓
Workflow composer
  ↓
Execution domain
  ├─ workflow
  ├─ task
  ├─ agent assignment
  ├─ context assembly
  └─ permission gate
        ↓
Developer / reviewer / verifier runtimes
  ↓
Generator / preview / governed apply
  ↓
VCTRL verification control plane
  ↓
Evidence bundle
  ↓
Activity Room projection
```

## Existing modules to reuse

- `vestara-apps/ai/src/pages/ActivityRoomPage.tsx`
- `src/onboarding/domain/execution.ts`
- `src/onboarding/service/execution-engine.ts`
- `src/onboarding/service/verification.ts`
- `src/car/domain/contracts.ts`
- `src/ai/runtime/model-router.ts`
- `src/context/service/context-service.ts`
- `src/permission/service/permission-service.ts`
- `src/workflow/service/workflow-service.ts`
- `src/task/service/task-service.ts`
- `src/generator/service/generation-service.ts`
- `src/generator/preview/preview.ts`
- `src/generator/apply/apply.ts`
- `scripts/verification/verify.ts`
- `scripts/verification/graph.ts`

## Projection targets

Activity Room should project:

- current execution status
- active workflow and milestone state
- agent presence and current role
- approval requests
- generated artifacts and preview state
- verification result and evidence links
- completion or failure state

Admin should project:

- operational summaries
- evidence and audit views
- permission decisions
- runtime health

The two surfaces must stay distinct:

- Activity Room = conversation and execution control
- Admin = operations and oversight
