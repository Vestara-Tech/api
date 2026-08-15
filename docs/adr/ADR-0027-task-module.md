# ADR-0027 — Task Module (TASK-001..008)

- Status: accepted
- Date: 2026-08-15
- Applies to: TASK-001 — TASK-008

## Context

Vestara's autonomous workflows need an execution-planning layer. Milestone,
Task, Workflow and Agent must stay distinct:

```text
Milestone = desired outcome / checkpoint
Task      = executable unit of work
Workflow  = orchestration/execution process
Agent     = possible executor
```

## Decision

**A milestone does not execute. A task does not define orchestration. A
workflow does not become the project-management database.**

### 1. Canonical Task model

`Task` (title, type, status, priority, milestoneId, parentTaskId, dependencies,
assignee, executor, acceptanceCriteria, verificationRequirements,
evidenceRequirements, externalBinding, labels, revision). Types span
engineering and beyond (implementation, research, approval, manual, ...).

### 2. Configurable lifecycle

`TaskLifecycle` with a standard policy (draft → ready → queued → in_progress →
awaiting_review → verification → completed) and alternate policies (manual-only
short path). Tasks aren't forced through every state.

### 3. First-class dependencies + cycle detection

`TaskDependencyGraph` builds requires/blocks edges, detects cycles, and
computes the ready set. Cyclic dependency graphs are invalid.

### 4. Executor abstraction

`TaskExecutor` (human | agent | workflow | service). The task owns the work
request; workflow owns how it gets executed. Agents can delegate to a workflow
without embedding it.

### 5. Completion requires evidence

`TaskResult` (outcome success/failure/partial/indeterminate, artifacts,
evidenceIds, verificationIds) is a durable execution history. A task is only
marked completed when a success result with evidence is recorded — workflow
execution never arbitrarily marks a task done.

## Consequences

- TASK-001..008 foundation complete: contracts, lifecycle, store, dependency
  graph, executor model, acceptance criteria, verification/evidence
  requirements, TaskResult/history + events, control API
  (`/api/v2/tasks/*`), capability `tasks`.
- 10 tests (7 unit + 3 integration). 506 total.
- TASK-009..015 (Workflow/Agent/Tool/Permission integration, external bindings,
  Task UI) follow.
