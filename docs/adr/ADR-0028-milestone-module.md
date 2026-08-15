# ADR-0028 — Milestone Module (MS-001..009)

- Status: accepted
- Date: 2026-08-15
- Applies to: MS-001 — MS-009

## Context

Autonomous workflows need an execution-planning layer. Milestone, Task,
Workflow and Agent must remain distinct:

```text
Milestone = desired outcome / checkpoint
Task      = executable unit of work
Workflow  = orchestration/execution process
Agent     = possible executor
```

## Decision

**A milestone does not execute. A task does not define orchestration. A
workflow does not become the project-management database.**

### 1. Milestone model + hierarchy

`Milestone` (objective, successCriteria, evidenceRequirements, taskIds,
childMilestoneIds, progress, revision). Nested milestones form a hierarchy:
Portfolio → Product → Milestone → Sub-Milestone → Task → Subtask — without
forcing all concepts into one model.

### 2. Status incl. at_risk

`draft/planned/ready/in_progress/at_risk/blocked/verification/completed/
cancelled/superseded`. Milestones have health; tasks generally don't.

### 3. Progress is DERIVED, never PATCHed

`MilestoneProgressEngine` computes completion (weighted per task type) and
execution from observable task state. `PATCH { progress: 75 }` is rejected by
construction.

### 4. Health/risk engine

`classifyHealth`: blocked tasks dominate → blocked; started-but-not-complete →
at_risk; else healthy/unknown. Blocked critical-path task is surfaced.

### 5. Completion requires evidence

`all tasks complete ≠ milestone complete`. The verification/evidence gate
requires: all tasks completed + all success criteria satisfied + all evidence
requirements met, before a milestone can complete.

## Consequences

- MS-001..009 foundation complete: contracts, hierarchy, lifecycle, store,
  task membership (Task module integration), derived progress engine, health/
  risk engine, success criteria, verification/evidence gate, control API
  (`/api/v2/milestones/*`), capability `milestones`.
- 9 tests (6 unit + 3 integration). 515 total.
- MS-010..015 (Planner/AI integration, Generator integration, events,
  Planning dashboard) follow.
