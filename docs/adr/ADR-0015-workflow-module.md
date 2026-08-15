# ADR-0015 — Workflow Module (WF-001..015)

- Status: accepted
- Date: 2026-08-15
- Applies to: WF-001 — WF-015

## Context

Vestara has Agents, Tools, Skills, AI, Generator, Auth, Configuration and other
platform areas, but no top-level orchestration layer. Engineering work needs a
durable execution graph: plan → implement → review → test → verify, with
approvals, failure policies, parallelism and evidence. The orchestrator must
never become a giant autonomous agent.

## Decision

The separation is locked:

```text
Workflow = decides WHAT executes and WHEN
Agent    = decides HOW to accomplish an assigned objective
Skill    = teaches an agent HOW to perform a capability
Tool     = performs an operation
AI       = intelligence/model execution
Runtime  = executes the agent/tool/workload
```

### 1. WorkflowDefinition is a durable execution graph

A workflow has identity, metadata, inputs, variables, triggers, and steps. Each
step is one of `agent | tool | service | approval | condition | parallel |
subworkflow | verification | delay`, with dependencies, retry/timeout/failure
policies, and optional `skipIf` conditions.

### 2. Steps reference definitions; they never embed them

A workflow step references an **Agent Definition** (by id + objective), a tool,
a service, a generator, or a subworkflow. Marketplace can later supply agents,
skills, tools, workflows, integrations and generators without modifying the
runtime.

### 3. Graph validity is structural

`WorkflowGraph` validates DAG integrity (no cycles, no unknown dependencies)
and computes a topological order for scheduling. Definitions cannot be
registered or published unless they form a valid DAG; cyclic definitions are
rejected with a 400.

### 4. The runtime is a durable dispatcher, not an agent

`WorkflowRuntime` walks the graph in topological order, dispatches ready steps
(bounded concurrency for parallel branches), gates on approvals (→ `waiting`),
respects failure policy (`suspend | fail | retry`), runs subworkflows, and
records evidence. Runs are resumable/cancellable/retryable with an explicit
state machine.

### 5. Conditions are safe expressions

`evaluateExpression` supports a safe subset (context refs, literals,
comparisons, boolean logic) with a tokenizer/parser — no `new Function`, no
code injection. Verification steps require their evidence-producing expressions
to hold before the workflow can complete.

### 6. Governance survives orchestration

Tool steps execute through the governed `ToolRuntime` (capability check → risk
policy → approval). Approval steps and control-risk tools suspend the run and
require a human/system decision — the workflow never self-approves. Agent steps
inherit the agent's permission model and skill resolution.

## Consequences

- WF-001..015 complete: definition + step contracts, DAG validation, execution
  state machine + durable runtime, agent/tool integration, conditions,
  approval gates, failure policy, parallelism, subworkflows, verification/
  evidence, events, and a control API (`/api/v2/workflows`,
  `/api/v2/workflow-runs/*`). 102 OpenAPI paths total, capability `workflows`.
- 17 tests (12 unit + 5 integration) covering graph validity, cycle rejection,
  dependency-ordered execution, tool + verification steps, approval suspension,
  skip conditions, failure, parallelism, publish/revisions, and the control API.
- WF-016 (AI workflow generator), WF-017 (Builder UI), WF-020 (Activity Room)
  follow in later milestones.
