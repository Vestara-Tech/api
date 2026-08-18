# Activity Room Execution Platform

This directory captures the current Activity Room baseline and the next
integration work for ARX.

Start here:

- [Execution contract](./execution-contract.md)
- [Capability matrix](./capability-matrix.md)
- [Integration map](./integration-map.md)
- [Execution gaps](./execution-gaps.md)

Grounding:

- [Activity Room roadmap](../plans/activity-room-roadmap.md)
- [Activity Room checklist](../plans/activity-room-checklist.md)
- [Verification policy](../engineering/verification-policy.md)

Status: draft

## Current state

Activity Room already exists as the AI app surface in
`vestara-apps/ai/src/pages/ActivityRoomPage.tsx`.
It currently streams agent activity and drives agent runs through the AI API,
but it is not yet the full governed execution control surface described by ARX.

The repository already has the supporting platform pieces ARX should reuse:

- resumable execution state, checkpoints, rollback, and evidence hashing
- a dedicated execution composition layer under `src/execution/**`
- a governed Activity Room preview route at `/api/v2/activity-room/preview`
- workflow and task lifecycle ownership
- agent, skill, tool, permission, and runtime abstractions
- governed generate / preview / apply / verify boundaries
- VCTRL verification control-plane logic

## Reading order

1. Read the execution contract.
2. Review the capability matrix.
3. Follow the integration map.
4. Use the gap register to plan implementation work.
