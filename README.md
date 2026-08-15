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

## Status

**API2-001 — Standalone API Foundation (complete).** Infrastructure-only:

- Repository bootstrap, strict TypeScript, pnpm, Node `node:test`
- Environment / configuration validation (`VESTARA_API_*`)
- Request + correlation context (`AsyncLocalStorage`)
- Structured JSON logging
- Canonical `VestaraError` + centralized error handling
- Liveness / readiness probes
- `/api/v2/system` + service identity
- Command bus, query bus, event bus
- Operation primitives + store
- Capability registry foundation
- OpenAPI v2 foundation (`contracts/openapi/vestara-v2.yaml`)
- Unit + integration + contract tests

Agents, workflows, generators, database, Marketplace, and diagnostics are
**not** part of API2-001 — they become API2-002+ capabilities once the
control-plane foundation is verified.

## Quickstart

```bash
pnpm install
pnpm build
pnpm test

# Run standalone
VESTARA_API_PORT=4310 pnpm start
```

## Endpoints (API2-001)

```text
GET /health/live        # liveness probe (unversioned)
GET /health/ready       # readiness probe (unversioned)
GET /api/v2             # service identity
GET /api/v2/system      # runtime status, uptime, enabled capabilities
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
├── server.ts            # HTTP server, routes, error handling
├── bootstrap/           # application composition, shutdown
├── config/              # environment + schema validation
├── core/                # commands, queries, events, operations, errors, context
├── capabilities/        # capability registry
├── infrastructure/      # logging
└── transport/           # HTTP router
contracts/openapi/       # vestara-v2.yaml (product contract)
tests/                   # unit / integration / contract
```
