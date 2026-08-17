# ADR-0051 — Worker module for background jobs and scheduling

- Status: accepted
- Date: 2026-08-17
- Applies to: Worker Module, EventBus, cross-module event wiring, scheduling

## Context

The repository has a fully wired `EventBus` (`src/core/events.ts`) with zero
production subscribers. Three modules publish events (Builder, Startup,
ImageBuilder) but nothing consumes them. The `CommandBus` and `QueryBus` are
unused scaffolding. There is no background processing infrastructure — no
queues, schedulers, or workers.

The `OperationStore` (`src/core/operations.ts`) tracks long-running operations
but has no execution engine. Modules that need cross-module reactions (e.g.,
"when a definition is published, update provenance") have no mechanism to
react.

The key gap:

> The platform can publish events but cannot subscribe to them in production.
> There is no way to run background work, schedule recurring tasks, or chain
> operations across module boundaries.

## Decision

> **Vestara will introduce a Worker Module that provides event-driven job
> creation, scheduled/recurring jobs, and a deterministic execution loop. The
> module is in-memory with a port boundary for future persistence swap.**

### 1. In-memory store with port boundary

The `WorkerStore` interface is the persistence port. The initial implementation
is in-memory (`InMemoryJobStore`). A future Redis, PostgreSQL, or NATS-backed
implementation can replace it without changing the domain logic.

The store exposes:

- `enqueue(job)` — add a job to the pending queue
- `claim(statuses)` — atomically dequeue a job in a claimable status
- `complete(id)` / `retry(id, nextRetryAt)` / `cancel(id)` — lifecycle transitions
- `list(filter)` / `count(filter)` / `get(id)` — observability
- `purgeCompleted(before)` — TTL cleanup

The `claim()` method is the concurrency primitive — it prevents double-execution
when multiple workers poll simultaneously.

### 2. Event bridge creates jobs from EventBus events

The `EventBridge` subscribes to the global `EventBus` and enqueues jobs for
each matched event type. This is the mechanism that gives the EventBus its
first production subscribers.

Each binding maps an event type to a job type:

| Event type | Job type | Purpose |
|-----------|----------|---------|
| `builder.definition.published` | `builder.after-publish` | Provenance logging, operation tracking |
| `startup.transition` | `startup.on-transition` | Diagnostics trigger on degradation |
| `workflow.completed` | `workflow.after-complete` | Update linked tasks |
| `workflow.failed` | `workflow.after-fail` | Record failure, retry or notify |
| `task.completed` | `task.after-complete` | Update milestone progress |
| `task.failed` | `task.after-fail` | Log failure, escalate if critical |

**Prerequisite:** Some modules currently store events locally, not on the
global EventBus. The worker module's implementation must include wiring the
key publishers (Builder, Startup, Workflow, Task) to publish to the global
EventBus before the event bridge can subscribe.

### 3. Scheduled/recurring jobs via cron evaluation

The `Scheduler` parses 5-field cron expressions and evaluates whether a
schedule is due at a given timestamp. The `ScheduleLoop` ticks every
`scheduleTickMs`, finds due schedules, and enqueues jobs.

Built-in schedules:

| Schedule | Cron | Job type | Purpose |
|----------|------|----------|---------|
| `worker.cleanup` | `*/10 * * * *` | `worker.cleanup` | Purge completed jobs |
| `system.health-check` | `*/5 * * * *` | `system.health-check` | Periodic health snapshot |
| `diagnostics.periodic` | `0 * * * *` | `diagnostics.run` | Hourly diagnostic check |
| `logs.rotation` | `0 0 * * *` | `logs.rotate` | Daily log cleanup |
| `ai.usage.agg` | `*/15 * * * *` | `ai.usage.aggregate` | Usage aggregation |

Schedules are managed via API (add, remove, enable/disable) and stored in the
same in-memory store.

### 4. Worker loop with configurable concurrency

The `WorkerLoop` polls the job store every `pollIntervalMs`, claims jobs up to
the configured `concurrency`, and executes handlers. Handlers are registered
by job type.

Execution flow:

```
poll → claim(pending) → lookup handler → execute → complete | retry
```

Retry policies:

| Policy | Behavior |
|--------|----------|
| `none` | Fail immediately |
| `fixed` | Retry after fixed delay |
| `exponential` | Exponential backoff: `delay * 2^attempt`, capped |

Default is exponential with 3 attempts.

### 5. No new backend module directory

The worker module follows the established module pattern:

```
src/worker/
  index.ts                    # Public barrel
  contracts.ts                # Job, JobHandler, Schedule, WorkerConfig
  store/
    job-store.ts              # Port interface
    in-memory-job-store.ts    # In-memory implementation
  domain/
    lifecycle.ts              # Job state machine
    retry.ts                  # Retry/backoff policies
    scheduler.ts              # Cron expression evaluation
  runtime/
    worker-loop.ts            # Core poll-execute loop
    event-bridge.ts           # EventBus → job bridge
    schedule-loop.ts          # Schedule evaluation loop
  service/
    worker-service.ts         # Public facade
  wiring/
    event-handlers.ts         # Cross-module event → job mappings
    schedule-definitions.ts   # Built-in schedule declarations
```

The module is composed in `createApplication()` via `buildWorkerPlatform()`,
following the same pattern as every other module. It does not introduce a new
composition mechanism.

### 6. Worker lifecycle is application-scoped

The worker starts after the HTTP server begins listening (in `main.ts`) and
stops during shutdown via `ShutdownCoordinator`. This ensures all routes and
services are ready before jobs execute.

### 7. Control API for observability and management

Routes at `/api/v2/worker/*`:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/v2/worker/jobs` | List jobs |
| `GET` | `/api/v2/worker/jobs/:id` | Get a job |
| `POST` | `/api/v2/worker/jobs` | Manually enqueue |
| `POST` | `/api/v2/worker/jobs/:id/cancel` | Cancel pending job |
| `POST` | `/api/v2/worker/jobs/:id/retry` | Retry failed job |
| `GET` | `/api/v2/worker/schedules` | List schedules |
| `POST` | `/api/v2/worker/schedules` | Add schedule |
| `DELETE` | `/api/v2/worker/schedules/:id` | Remove schedule |
| `GET` | `/api/v2/worker/stats` | Worker stats |

### 8. Admin UI integration

A `WorkerPage` in the admin UI provides operational control:

- MetricCards: pending, running, completed, failed
- Job table with status, type, attempts, timestamps
- Schedule list with cron, last/next run, enable toggle
- Cancel/retry actions per job
- Stats card: throughput, failure rate

Navigation entry in the Operations group with `worker` capability gating.

## Consequences

- Cross-module event reactions become possible for the first time.
- The EventBus gains production subscribers, validating the pub/sub design.
- Recurring system tasks (cleanup, health checks, diagnostics) have a home
  instead of ad-hoc `setTimeout` patterns.
- The `OperationStore` can delegate execution to worker jobs instead of
  remaining a passive tracker.
- The module follows the same composition pattern as every other module — no
  new infrastructure paradigms.
- In-memory persistence means jobs are lost on restart; this is acceptable
  for the initial implementation and documented as a known limitation.
- The port boundary allows swapping to Redis/NATS/PostgreSQL without changing
  domain logic or handler registrations.
- Admin gets operational visibility into background work, completing the
  control-plane surface.

## Implementation sequence

1. Define domain contracts (`Job`, `JobHandler`, `Schedule`, `WorkerConfig`).
2. Implement `JobStore` port and `InMemoryJobStore`.
3. Implement job lifecycle state machine and retry policies.
4. Implement `WorkerLoop` (poll-execute-concurrent).
5. Implement `EventBridge` (EventBus subscription → job creation).
6. Implement `Scheduler` and `ScheduleLoop` (cron evaluation).
7. Implement `WorkerService` facade.
8. Wire cross-module event publishers to global EventBus.
9. Register event → job handler mappings and schedule definitions.
10. Add bootstrap composition (`buildWorkerPlatform`).
11. Add control API routes.
12. Add Admin UI page and client methods.
13. Add tests (unit + integration).
14. Register `worker` capability and verification module map.

## Routing rule

If the work is about executing background jobs, scheduling recurring tasks, or
reacting to cross-module events, it belongs to the Worker Module.

If the work is about the domain logic that a job invokes (e.g., what happens
when a definition is published), it belongs to the originating module. The
Worker Module only orchestrates execution — it does not own business logic.

If a job needs to call a service in another module, it does so through the
same service interfaces used by route handlers — never by reaching into
another module's internals.
