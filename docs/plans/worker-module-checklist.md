# Worker Module — Implementation Checklist

Grounding:

- [ADR-0051 — Worker module for background jobs and scheduling](../adr/ADR-0051-worker-module-background-jobs-and-scheduling.md)
- [Verification policy](../engineering/verification-policy.md)

Status: draft

## Objective

Add background job execution and scheduled/recurring task infrastructure to the
platform. Wire cross-module EventBus events to job handlers. Provide
observability and operational control through the Admin UI.

## Phase 1 — Domain contracts and store

Goal: define the core types and persistence port before any runtime logic.

Files:

- `src/worker/index.ts`
- `src/worker/contracts.ts`
- `src/worker/store/job-store.ts`
- `src/worker/store/in-memory-job-store.ts`
- `src/worker/domain/lifecycle.ts`
- `tests/unit/worker-store.test.ts`

Add:

- `Job` type with lifecycle fields (id, type, status, payload, attempts, metadata)
- `JobHandler` function type
- `Schedule` type with cron expression and job binding
- `WorkerConfig` type with poll interval, concurrency, TTL, retry defaults
- `JobStore` interface with `enqueue`, `claim`, `complete`, `retry`, `cancel`, `list`, `count`, `get`, `purgeCompleted`
- `InMemoryJobStore` implementation with atomic `claim()` using status check
- Job state machine: `pending → running → completed | failed | retrying | cancelled`

Checklist:

- [ ] types compile and are exported from barrel
- [ ] `InMemoryJobStore` handles concurrent `claim()` without double-execution
- [ ] job lifecycle transitions are validated (cannot complete a cancelled job, etc.)
- [ ] `purgeCompleted` returns count of removed jobs
- [ ] unit tests cover enqueue/claim/complete/retry/cancel/purge

Verification:

- [ ] `pnpm verify:module -- worker`
- [ ] `pnpm run test:one tests/unit/worker-store.test.ts`

## Phase 2 — Retry policies and worker loop

Goal: execute jobs with configurable concurrency and retry behavior.

Files:

- `src/worker/domain/retry.ts`
- `src/worker/runtime/worker-loop.ts`
- `src/worker/service/worker-service.ts`
- `tests/unit/worker-loop.test.ts`

Add:

- `RetryPolicy` type: `none`, `fixed`, `exponential`
- `RetryCalculator` with `nextDelay(policy, attempt, baseDelay)` computation
- `WorkerLoop` class: poll-execute-concurrent loop
  - polls `jobStore.claim([pending])` every `pollIntervalMs`
  - executes handler up to `concurrency` parallel slots
  - on success: `store.complete(id)`
  - on failure: `store.retry(id, nextRetryAt)` or `store.complete(id, error)`
  - `start()` / `stop()` lifecycle
- `WorkerService` facade with `registerHandler`, `enqueue`, `getJob`, `listJobs`, `cancelJob`, `retryJob`, `stats`

Checklist:

- [ ] worker loop respects concurrency limit
- [ ] retry policies compute correct delays
- [ ] handler lookup fails gracefully for unknown job type
- [ ] `stop()` waits for in-flight jobs to complete
- [ ] `enqueue` returns the created job
- [ ] unit tests cover loop lifecycle, concurrency, retry paths

Verification:

- [ ] `pnpm verify:module -- worker`
- [ ] `pnpm run test:one tests/unit/worker-loop.test.ts`

## Phase 3 — Event bridge

Goal: subscribe to the global EventBus and create jobs from events.

Files:

- `src/worker/runtime/event-bridge.ts`
- `tests/unit/worker-event-bridge.test.ts`

Add:

- `EventBridge` class that binds event types to job types
- `bind(eventType, jobType, options?)` returns unsubscribe function
- `extractPayload` option for custom event-to-payload mapping
- `maxAttempts` option per binding
- Jobs created by event bridge have `source: 'event'`

Checklist:

- [ ] event bridge subscribes to EventBus and enqueues jobs
- [ ] unsubscribe removes the binding and stops job creation
- [ ] custom `extractPayload` transforms event payload correctly
- [ ] event bridge uses the global EventBus, not a local copy
- [ ] jobs created from events have `source: 'event'` and `correlationId`
- [ ] unit tests cover bind/unbind/extractPayload

Verification:

- [ ] `pnpm verify:module -- worker`
- [ ] `pnpm run test:one tests/unit/worker-event-bridge.test.ts`

## Phase 4 — Scheduler and schedule loop

Goal: support recurring jobs via cron expressions.

Files:

- `src/worker/domain/scheduler.ts`
- `src/worker/runtime/schedule-loop.ts`
- `src/worker/service/worker-service.ts` (add schedule methods)
- `tests/unit/worker-scheduler.test.ts`

Add:

- `CronParser` that parses 5-field cron expressions
- `isDue(schedule, currentTime)` that evaluates whether a schedule fires
- `ScheduleLoop` that ticks every `scheduleTickMs`, evaluates due schedules, enqueues jobs
- `WorkerService` additions: `addSchedule`, `removeSchedule`, `listSchedules`
- Jobs created by schedule have `source: 'schedule'`

Checklist:

- [ ] cron parser handles wildcard, ranges, steps, lists
- [ ] `isDue` correctly evaluates minute/hour/day/month/weekday fields
- [ ] schedule loop enqueues jobs only when due
- [ ] `lastRunAt` and `nextRunAt` are updated after enqueue
- [ ] disabled schedules are skipped
- [ ] unit tests cover cron parsing, due evaluation, schedule lifecycle

Verification:

- [ ] `pnpm verify:module -- worker`
- [ ] `pnpm run test:one tests/unit/worker-scheduler.test.ts`

## Phase 5 — Bootstrap wiring and routes

Goal: integrate the worker module into the application composition and expose the control API.

Files:

- `src/bootstrap/worker.ts`
- `src/bootstrap/application.ts` (add `buildWorkerPlatform` call)
- `src/routes/worker.ts`
- `src/routes/index.ts` (register worker routes)
- `src/index.ts` (export worker service)
- `tests/integration/worker-api.test.ts`

Add:

- `buildWorkerPlatform(options)` following the `build*Platform()` pattern
- Wire `WorkerService` into the container
- Register `worker` capability via `CapabilityRegistry`
- Route definitions: jobs (list/get/enqueue/cancel/retry), schedules (list/add/remove), stats
- Wire `ShutdownCoordinator` to stop worker loop on shutdown

Checklist:

- [ ] `buildWorkerPlatform` composes store, service, event bridge, schedule loop
- [ ] worker service is registered in the container
- [ ] worker capability is registered
- [ ] routes respond correctly for all endpoints
- [ ] shutdown stops the worker loop gracefully
- [ ] integration tests cover job lifecycle through API

Verification:

- [ ] `pnpm verify:module -- worker`
- [ ] `pnpm run test:one tests/integration/worker-api.test.ts`

## Phase 6 — Cross-module event publisher wiring

Goal: make existing modules publish to the global EventBus so the event bridge has events to consume.

Files:

- `src/bootstrap/application.ts` (pass EventBus to modules)
- `src/builder/service/builder-service.ts` (publish after definition publish)
- `src/startup/startup-coordinator.ts` (publish on state transition)
- `src/workflow/service/workflow-service.ts` (publish on completion/failure)
- `src/task/service/task-service.ts` (publish on completion/failure)

Add:

- Each module receives the global EventBus during composition
- Publish events after key state transitions:
  - `builder.definition.published` — after definition publish
  - `startup.transition` — after state change
  - `workflow.completed` / `workflow.failed` — after workflow terminal state
  - `task.completed` / `task.failed` — after task terminal state

Checklist:

- [ ] Builder publishes `builder.definition.published` to global EventBus
- [ ] Startup publishes `startup.transition` to global EventBus
- [ ] Workflow publishes `workflow.completed` / `workflow.failed`
- [ ] Task publishes `task.completed` / `task.failed`
- [ ] existing local event handling (if any) is preserved
- [ ] event payloads match the shape expected by event bridge bindings

Verification:

- [ ] `pnpm verify:platform` (cross-module changes require full verification)

## Phase 7 — Event → job handler mappings and schedules

Goal: register the concrete handlers and built-in schedules.

Files:

- `src/worker/wiring/event-handlers.ts`
- `src/worker/wiring/schedule-definitions.ts`
- `src/worker/bootstrap/worker.ts` (wire handlers and schedules)
- `tests/unit/worker-handlers.test.ts`

Add:

- Event → job handler mappings per ADR-0051 section 2
- Built-in schedule definitions per ADR-0051 section 3
- Handler implementations that call existing service methods across modules
- `registerEventHandler(service, events)` and `registerSchedules(service)` helpers

Checklist:

- [ ] all event → job bindings are registered at startup
- [ ] handlers call the correct service methods in the target module
- [ ] built-in schedules are registered and evaluate correctly
- [ ] handler errors are caught and recorded as job failures
- [ ] unit tests cover handler invocation and error paths

Verification:

- [ ] `pnpm verify:module -- worker`

## Phase 8 — Admin UI integration

Goal: add operational visibility and control to the Admin dashboard.

Files:

- `vestara-apps/admin/src/pages/WorkerPage.tsx`
- `vestara-apps/admin/src/api/client.ts` (add worker methods)
- `vestara-apps/admin/src/api/contracts.ts` (add worker types)
- `vestara-apps/admin/src/app/App.tsx` (add route)
- `vestara-apps/admin/src/app/navigation/navigation.ts` (add entry)
- `vestara-apps/admin/tests/navigation.test.ts` (update)

Add:

- `WorkerPage` with MetricCards (pending, running, completed, failed)
- LoadableCard: job table with status, type, attempts, created/completed
- LoadableCard: schedule list with cron, last/next run, enable toggle
- Action buttons: cancel/retry per job, enable/disable per schedule
- Stats card: throughput, failure rate
- Admin API client methods:
  - `listWorkerJobs`, `getWorkerJob`, `enqueueWorkerJob`
  - `cancelWorkerJob`, `retryWorkerJob`
  - `listWorkerSchedules`, `addWorkerSchedule`, `removeWorkerSchedule`
  - `getWorkerStats`
- Navigation entry in Operations group with `worker` capability

Checklist:

- [ ] `WorkerPage` renders MetricCards and LoadableCards
- [ ] job list is filterable by status and type
- [ ] cancel/retry buttons call the correct API methods
- [ ] schedule list shows cron expression and next run time
- [ ] navigation entry is capability-gated
- [ ] `AdminApiClient` methods compile and use correct wire types

Verification:

- [ ] `pnpm verify:module -- admin`
- [ ] `pnpm contracts:frontend:check`

## Phase 9 — Tests

Goal: comprehensive test coverage for the worker module.

Files:

- `tests/unit/worker-store.test.ts`
- `tests/unit/worker-loop.test.ts`
- `tests/unit/worker-event-bridge.test.ts`
- `tests/unit/worker-scheduler.test.ts`
- `tests/unit/worker-handlers.test.ts`
- `tests/integration/worker-api.test.ts`

Add:

- Unit tests for store, loop, event bridge, scheduler, handlers
- Integration tests for full job lifecycle through API
- Tests for concurrent claim, retry backoff, schedule evaluation
- Tests for error handling and graceful shutdown

Checklist:

- [ ] store tests: enqueue, claim, complete, retry, cancel, purge, concurrent access
- [ ] loop tests: poll, execute, concurrency limit, stop, handler error
- [ ] event bridge tests: bind, unbind, extract payload, correlation ID
- [ ] scheduler tests: cron parsing, due evaluation, schedule lifecycle
- [ ] handler tests: correct service invocation, error propagation
- [ ] integration tests: create job, execute, verify completion, cancel, retry
- [ ] all tests pass with `pnpm test:api`

Verification:

- [ ] `pnpm verify:module -- worker`
- [ ] `pnpm verify:platform`

## Implemented files

_To be filled as implementation progresses._

## Verification rule

Each phase must end with:

- implementation complete
- typecheck passes (`pnpm verify:static`)
- targeted tests pass (`pnpm verify:module -- worker`)
- evidence recorded

After all phases:

- `pnpm verify:platform`
- `pnpm contracts:frontend:check`
- `pnpm openapi:check`

Do not mark the checklist complete until:

- worker module executes jobs with retry and concurrency
- event bridge subscribes to EventBus and creates jobs
- schedules evaluate and enqueue recurring jobs
- Admin UI shows worker status and provides operational control
- all tests pass and verification evidence is recorded
