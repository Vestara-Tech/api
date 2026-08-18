# Activity Room Execution Contract

Status: draft

## Purpose

Activity Room is the human control surface for governed Vestara execution.
It receives intent, shows planning and execution state, and renders evidence.
It does not own execution state or verification authority.

## Core invariant

```text
Intent → Plan → Governed Execution → Verification → Evidence → Completion
```

## Contract rules

1. Natural-language requests are intents, not shell commands.
2. Activity Room renders execution state; it does not own execution state.
3. Agents never receive unrestricted platform capabilities.
4. Skills describe how work should be performed.
5. Tools define what operations an agent may request.
6. Permissions decide whether those operations are allowed.
7. Workflows own lifecycle and decomposition.
8. Tasks and milestones own work breakdown.
9. Context is assembled, not dumped wholesale.
10. Coding runtimes are adapters, not agents.
11. VCTRL determines sufficient verification.
12. Evidence must exist before completion is reported.
13. Every consequential action must be attributable.
14. Execution must be resumable after browser or server interruption.

## Ownership boundaries

| Area | Owns | Does not own |
| --- | --- | --- |
| Activity Room | user-facing execution narrative, prompts, approvals, live status | workflow lifecycle, verification policy, agent identity, permission policy |
| Workflow module | workflow lifecycle and composition | UI rendering, agent runtime selection |
| Task module | task lifecycle and dependency structure | intent interpretation |
| Agent module | agent identity, role, runtime binding | workflow authority |
| Permission module | allow / deny / approval decisions | execution planning |
| Verification control plane | required verification scope and evidence | agent policy, UI state |

## Current implementation signals

- `vestara-apps/ai/src/pages/ActivityRoomPage.tsx` already streams agent activity.
- `src/onboarding/domain/execution.ts` already models resumable execution state.
- `src/onboarding/service/execution-engine.ts` already manages execution steps.
- `src/onboarding/service/verification.ts` already runs verification against execution state.
- `src/generator/service/generation-service.ts` already provides governed generation flows.
- `scripts/verification/verify.ts` already owns impact-based verification selection.

## ARX requirement

The Activity Room implementation must preserve these invariants while adding
projection, orchestration, and evidence surfaces.
