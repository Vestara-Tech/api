# Activity Room Execution Gaps

Status: draft

This register identifies the ARX gaps that still need implementation.

## Orchestration gaps

1. Execution composition layer exists, but it still needs broader intent and capability coverage for more ARX goal types.
2. Resume/recovery pathways are not yet surfaced through the Activity Room UI.
3. Full agent assignment, runtime policy, and permission-gated execution are still projected rather than driven end-to-end from the room.
4. No stable execution event stream for projections.

## Projection gaps

1. Activity Room currently shows agent activity, but not the full execution spine.
2. There is no dedicated execution inspector/timeline surface.
3. Approvals and verification are not yet unified into one execution narrative.
4. Admin currently holds some operational views, but not a complete execution projection model.

## Integration gaps

1. Workflow, task, agent, permission, and runtime modules are not yet composed by a shared execution domain.
2. Generator preview/apply flows are not yet wired end-to-end from Activity Room.
3. Verification control-plane results are not yet surfaced as a first-class execution outcome in the room.

## UI gaps

1. No shared Activity Room execution primitives exist yet.
2. The current room uses a narrow agent-run interaction model rather than an execution console.
3. There is no vertical slice proving intent → plan → governed execution → verification → evidence.

## Prioritized follow-up

1. Expand `src/execution/**` beyond preview into explicit request, resume, and recovery paths.
2. Add richer intent resolution for more goal types and ambiguity handling.
3. Bind agent assignment, runtime policy, context assembly, and permissions.
4. Integrate VCTRL and evidence more deeply into execution completion.
5. Project the fuller execution spine into Activity Room.
