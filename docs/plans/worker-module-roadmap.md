# Worker Module Roadmap

Grounding:

- [ADR-0051 — Worker module for background jobs and scheduling](../adr/ADR-0051-worker-module-background-jobs-and-scheduling.md)
- [Worker Module — Implementation Checklist](./worker-module-checklist.md)
- [Verification policy](../engineering/verification-policy.md)

Status: draft

## Goal

Introduce a governed background execution layer for Vestara that can run jobs,
retries, schedules, and event-driven follow-up work without moving business
logic out of the modules that own it.

The Worker Module should be the platform’s execution runtime for work that is
actually long-running, recurring, or event-driven. It should not own business
rules; it orchestrates execution for other modules.

## What the Worker Module is for

Use the Worker Module when the platform needs to:

- execute jobs in the background
- retry failed work with policy
- schedule recurring tasks
- react to cross-module events
- coordinate long-running or delayed operations
- surface operational state to Admin

Use existing module services directly when the work is:

- short-lived
- synchronous
- purely request/response
- already governed by the owning module

## Current baseline

The repository already has the intended architectural direction in ADR-0051:

- Job contracts and lifecycle semantics
- Store and runtime loop concepts
- Event bridge between modules and jobs
- Scheduler and recurring task concepts
- Admin operations surface

The current implementation plan is already laid out in
[`worker-module-checklist.md`](./worker-module-checklist.md). This roadmap
exists to explain the sequencing and runtime boundary.

## Implementation sequence

### Step 1 — Define the job model

Establish the contracts first:

- job lifecycle
- store interface
- retry policy
- worker configuration
- schedule definition

Outcome:

- the job model is stable before runtime code begins

### Step 2 — Build the worker loop

Add the core execution loop:

- poll
- claim
- execute
- complete
- retry
- stop gracefully

Outcome:

- background jobs can execute deterministically

### Step 3 — Bridge events into jobs

Connect the global EventBus to the worker runtime:

- event bindings
- payload extraction
- correlation metadata
- unsubscribe support

Outcome:

- modules can trigger background work without direct coupling to worker internals

### Step 4 — Add schedules

Introduce cron-driven recurring jobs:

- schedule storage
- cron parsing
- due evaluation
- schedule loop

Outcome:

- recurring background tasks become first-class platform behavior

### Step 5 — Wire the application

Compose the worker into the platform:

- bootstrap integration
- container registration
- capability registration
- route exposure
- shutdown coordination

Outcome:

- the worker becomes part of the control plane

### Step 6 — Publish module events

Update the existing modules that should emit jobs:

- builder
- startup
- workflow
- task

Outcome:

- the worker has real events to consume

### Step 7 — Register default handlers and schedules

Add the concrete event/job mappings and built-in schedules described in the ADR.

Outcome:

- the worker becomes useful without custom wiring

### Step 8 — Expose Admin operations

Add operational visibility and control to Admin:

- jobs
- schedules
- stats
- failures
- retries

Outcome:

- operators can inspect and manage background execution

## Runtime boundary

The Worker Module is the runtime boundary for background execution.

The modules that own business logic remain the source of truth. They publish
events or enqueue jobs, and the worker executes follow-up work on their behalf.

That means:

```text
owning module → event/job contract → worker runtime → execution
```

not:

```text
owning module → business logic moved into worker
```

## Exit criteria

The Worker Module is ready for broad use when:

- jobs can be enqueued, claimed, executed, retried, and completed
- schedules can create recurring jobs
- cross-module events can create jobs
- the worker stops cleanly on shutdown
- Admin can inspect and manage the worker
- verification evidence exists for the runtime behavior

## Relationship to the checklist

This roadmap gives the sequence and runtime boundary.
The checklist in `worker-module-checklist.md` is the execution plan.

When implementation begins, the checklist should drive the work item by item.
