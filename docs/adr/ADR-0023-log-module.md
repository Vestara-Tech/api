# ADR-0023 — Log Module (LOG-001..010)

- Status: accepted
- Date: 2026-08-15
- Applies to: LOG-001 — LOG-010

## Context

Fastify/Pino logging exists but is an implementation detail. Every Vestara
module, agent and future app needs operational logging; without a contract each
invents its own structure. Logging must also be queryable by correlation.

## Decision

**vestara.log** collects, normalizes, correlates, routes, retains, queries,
streams and exports operational logs. It is NOT the owner of telemetry, audit,
evidence, diagnostics or notifications.

### 1. Canonical LogRecord

`LogRecord` (id, timestamp, level, message, source, correlation/trace/workflow/
agent/operation ids, attributes, error). Modules never invent their own
structure. Pino remains the Node implementation; this is the contract around it.

### 2. Source identity

Every record identifies its `LogSource` (type + id: `api`, `module`, `agent`,
`workflow`, `application`, `os`, ...). Source registry tracks distinct sources.

### 3. Correlation propagation

requestId → correlationId → workflowId → agentId → operationId. All logs from
one request are queryable by the original correlation id — the Activity Room
can answer "show everything that happened because of this request".

### 4. Redaction is foundational

`LogRedactor` masks authorization headers, API keys, OAuth/session tokens,
passwords and `secret://` references (key-aware AND value-pattern) before
storage. Configuration's secret-reference model is respected.

### 5. Storage abstraction

`LogStore` (append/appendBatch/query/tail/count/deleteBefore/aggregate).
`InMemoryLogStore` ships now; JSONL, Postgres, Loki and OTel exporters come
later. No external system is mandatory.

### 6. Structured logging only

Console.log is discouraged; the `LoggerFacade` (info/warn/error + child
sources) is the surface. Agent logging never logs full prompts by default.

## Consequences

- LOG-001..010 foundation complete: contracts, logger facade, correlation
  propagation, source registry, redaction pipeline, LogStore + in-memory,
  query engine (level/source/correlation/agent/workflow/message/time),
  aggregation, control API (`/api/v2/logs/*`), capability `logs`.
- 9 tests (6 unit + 3 integration). 469 total.
- LOG-011..018 (Agent/Workflow integration, journald, OTel export, Log Viewer
  UI, retention) follow. Logs never delete audit/evidence data.
