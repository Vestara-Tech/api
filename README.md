# Vestara API v2

Standalone **Vestara Platform Gateway and Control Plane**.

```text
Repository:  Vestara-Tech/api
Package:     @vestara/api
Service:     vestara-api
API version: v2
Runtime:     Node.js 22+ / TypeScript (strict)
Protocol:    /api/v2
```

This repository is **independent of the Vestara monorepo** — it has no dependency
on the Workspace UI and compiles, tests, and runs on its own.

## Technology Stack

| Concern       | Choice                                              |
|---------------|-----------------------------------------------------|
| Runtime       | Node.js 22+ (Node 24 target)                        |
| HTTP          | **Fastify**                                         |
| Schema        | **TypeBox** + JSON Schema / Ajv (Fastify validator) |
| API spec      | **OpenAPI 3.1** (`@fastify/swagger`)                |
| API explorer  | **Scalar** at `/docs`                               |
| Logging       | **Pino** (Fastify logger)                           |
| Tracing       | **OpenTelemetry** spans per request                 |
| Unit / HTTP   | **Vitest** + Fastify `inject()`                     |
| Events        | In-memory `EventBus` abstraction (NATS later)       |

## Status

**API2-001 — Standalone API Foundation (complete).** Infrastructure-only:

- Fastify server with TypeBox schema validation and OpenAPI 3.1 generation
- Scalar API reference at `/docs`
- Pino structured logging with Vestara fields (`requestId`, `correlationId`,
  `traceId`, `operationId`, `actorId`, `workspaceId`, ...)
- OpenTelemetry server spans per request
- Request + correlation context (AsyncLocalStorage + `x-*` headers)
- Canonical `VestaraError` + centralized error handling + 404 handler
- Liveness / readiness probes, `/api/v2/system`, service identity
- Command bus, query bus, event bus
- Operation primitives + store
- Capability registry foundation
- Committed OpenAPI contract (`contracts/openapi/vestara-api-v2.json`) with a
  CI drift check (`pnpm openapi:check`)
- Unit + integration + contract tests (Vitest, Fastify `inject()`)

Agents, workflows, generators, database, Marketplace, and diagnostics are
**not** part of API2-001 — they become API2-002+ capabilities once the
control-plane foundation is verified. PostgreSQL/Redis/NATS/Prisma and external
runtimes stay behind ports; the API boots and passes tests without them.

## Quickstart

```bash
pnpm install
pnpm build
pnpm test

# Run standalone
VESTARA_API_PORT=4310 pnpm start

# Developer mode (hot reload)
pnpm dev
```

## Endpoints (API2-001)

```text
GET /health/live          # liveness probe (unversioned)
GET /health/ready         # readiness probe (unversioned)
GET /api/v2               # service identity
GET /api/v2/system        # runtime status, uptime, enabled capabilities
GET /docs/                # Scalar API reference
GET /docs/openapi.json    # generated OpenAPI 3.1 document
```

Unknown routes return the canonical v2 error shape:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "No route for GET /api/v2/nope",
    "requestId": "req_...",
    "correlationId": "cor_...",
    "retryable": false,
    "details": {}
  }
}
```

Every response carries `x-request-id`, `x-correlation-id`, and `x-trace-id`
headers; incoming `x-correlation-id` is propagated.

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `VESTARA_API_HOST` | `127.0.0.1` | Bind address |
| `VESTARA_API_PORT` | `4310` | Bind port |
| `VESTARA_API_LOG_LEVEL` | `info` | `debug\|info\|warn\|error` |
| `VESTARA_API_REQUEST_TIMEOUT_MS` | `30000` | Request timeout |

## Layout

```text
src/
├── main.ts              # entrypoint, signal handling
├── app.ts               # Fastify app factory (plugins + routes)
├── bootstrap/           # application composition, shutdown
├── config/              # environment + schema validation
├── core/                # commands, queries, events, operations, errors, context
├── capabilities/        # capability registry
├── infrastructure/      # pino logger
├── plugins/             # request-context, error-handler, telemetry, openapi
├── routes/              # health, system (TypeBox schemas)
└── types/               # fastify module augmentation
contracts/openapi/       # vestara-api-v2.json (committed product contract)
scripts/                 # generate-openapi.ts, check-openapi.ts
tests/                   # unit / integration (inject) / contract
```

## OpenAPI contract

The generated contract is committed and CI-enforced:

```bash
pnpm openapi:generate    # regenerate contracts/openapi/vestara-api-v2.json
pnpm openapi:check       # fail if the committed contract drifts from the app
```
