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

**API2-002 — API Definition Runtime (complete).** The durable domain model the
Builder UI and future Generator/Agent modules will drive:

- `ApiDefinition` aggregate — resources (fields / relations / indexes),
  endpoints (method / path / parameters / request / responses / policies /
  capabilityBinding), policies, operations, events, revision, metadata
- Lifecycle state machine: `draft → validating → ready → publishing →
  published`, with invalid→draft, superseded, and rollback
- `DefinitionValidator` — deterministic structural validation
- `ContractCompiler` — deterministic contract hash (same definition + same
  compiler version → same hash), TypeBox schemas, OpenAPI 3.1, route
  definitions; the hash is stored with each published revision (evidence /
  provenance friendly)
- `ApiDefinitionService` — create / get / list / update / remove / validate /
  preview / publish / rollback / revisions; publish records a revision hash and
  drives a `api.publish` operation through the OperationStore; lifecycle events
  (`builder.definition.*`) publish to the EventBus
- `DraftStore` port + `InMemoryDraftStore` (persistence is swappable)
- **AI port contracts (types only)** — `ApiBuilderAiPort`,
  `AiBuilderProposal`, `ApiDefinitionPatch`. AI is an optional capability: it
  produces revision-scoped typed patches; it never activates routes or
  publishes. Capabilities `builder.ai.*` are declared but inactive until an
  adapter is installed.
- Builder capability registered (`builder` appears in `/api/v2/system`)

**API2-003 — Builder Control API (complete).** Thin HTTP layer over
`ApiDefinitionService`:

- `POST/GET /api/v2/builder/definitions`, `GET/PATCH/DELETE .../:id`
- `POST .../:id/validate`, `.../preview`, `.../publish`
- `GET .../revisions`, `GET .../revisions/:revision`, `POST .../rollback`
- **Optimistic concurrency** via `If-Match: "revision-N"` on PATCH / DELETE /
  publish → stale editors get `409 Conflict`
- **Rich preview contract**: `{ definition, validation, contract { hash,
  compilerVersion, openapi, routes }, compatibility { classification, changes },
  publishable }` — one endpoint for the Builder review panel
- **Compatibility analyzer** (API2-004 groundwork): classifies
  breaking/compatible changes vs the last published revision (field type
  change, field removed, field became required, endpoint removed, resource
  removed)
- **Pagination/filtering** on list: `?cursor=&limit=&status=&search=&sort=`
- Registered in OpenAPI (12 paths total) with a drift gate

**AUTH-001..006 — Authentication Platform (complete).** Provider-neutral
identity foundation — external providers are optional integrations, never the
identity model:

- **AUTH-001** `Identity` / `Principal` contracts — `PrincipalKind`
  (`human | agent | service | application | module | device`), `ExternalIdentity`
  keyed by `(integration, providerSubject)`, never email
- **AUTH-002** Credential contracts + `ScryptPasswordHashing` (local, offline,
  no external deps); kinds: password, passkey, oauth, oidc, service-token,
  api-key, machine
- **AUTH-003** Session runtime — opaque session tokens, expiry, revocation,
  per-identity session listing
- **AUTH-004** `AuthenticationContext` + Fastify plugin — Bearer/session token
  resolves to a context on `request.authContext`; `requireAuth` guard
- **AUTH-005** Authorization boundary — `AuthorizationService` permission
  checks with policy rules (deny overrides, approval-required flags)
- **AUTH-006** `ExternalIdentityProvider` port (types only) — the auth module
  never imports Google/GitHub/Facebook SDKs; adapters supply the contract
- Account linking (`IdentityService.linkExternal`) keyed by stable subject
- Routes: `POST /api/v2/auth/login|logout`, `GET .../me|sessions`,
  `POST .../sessions/:id/revoke`, `POST .../check`
- Auth capability registered (`auth` in `/api/v2/system`); 18 OpenAPI paths
  total with drift gate

**CONFIG-001..008 — Configuration Platform (complete).** Vestara's typed,
layered, observable configuration control plane — not a glorified `.env`
reader. Configuration and Generator are independent platform modules: the API
consumes them via capabilities, never the reverse:

- **CONFIG-001** `ConfigurationDefinition<T>` — namespace, version, schema,
  defaults, scopes, secret fields; extensible scope model (`system` →
  `runtime` precedence)
- **CONFIG-002** `SchemaRegistry` — packages register schemas; leaf-key
  derivation from defaults
- **CONFIG-003** `LayeredResolver` — deterministic precedence (defaults →
  system → environment → … → runtime), runtime overrides
- **CONFIG-004** `ConfigurationValidator` — definition + value + secret-field
  diagnostics
- **CONFIG-005** `SecretReference` — config stores references
  (`secret://store/path`), never literal secrets
- **CONFIG-006** draft → validate → apply → rollback lifecycle with revision
  history
- **CONFIG-007** change events + watchers with hot-reload / restart-required
  semantics
- **CONFIG-008** control API: `GET /api/v2/config/schemas|keys|resolved`,
  `POST .../drafts|drafts/:id/validate|apply`, `GET .../scopes/:scope/revisions`,
  `POST .../scopes/:scope/rollback`
- Registered `config` capability; example definitions `vestara.api`,
  `vestara.auth`; 27 OpenAPI paths total with drift gate

**GEN-001..006 — Generator Platform (complete).** A general Vestara artifact
generation platform — not an API-code generator specifically. Independent
module (API → Generator); consumed via capabilities:

- **GEN-001** `Generator<TInput, TOutput>` contracts + governed lifecycle
  (`REQUEST → PLAN → GENERATE → ARTIFACT SET → VALIDATE → PREVIEW/DIFF →
  POLICY/APPROVAL → APPLY → VERIFY → EVIDENCE`)
- **ConfigurationSnapshot into GenerationContext** — generators receive an
  immutable resolved-config snapshot (snapshotHash, values, source scopes,
  secret references); never reach into Configuration globally
- **GEN-002** `GeneratorRegistry` — register/unregister/discover/capabilities/
  compatibility
- **GEN-003** `GenerationPlan`/`GenerationStep` — dependencies, requirements,
  warnings, planHash
- **GEN-004** Template platform — `TemplateDefinition`, `TemplateRegistry`,
  `TemplateRenderer` (deterministic `{{ }}` substitution), versioning
- **GEN-005** Artifact model — `Artifact`, `ArtifactSet`, `ArtifactManifest`,
  content hashing, provenance; generators never write files (they emit an
  ArtifactSet an apply port consumes)
- **GEN-006** Determinism boundary — `GenerationEvidence`
  (generator version + input hash + configuration hash + template hashes →
  output hash → evidenceHash); same inputs ⇒ same evidence
- **Secret rule** — generators only see `secret://` references; a
  secrets-requiring generator is rejected unless policy approves, and
  `secretsResolved` stays false in the snapshot
- Example generator `generator.api.typescript` (template-driven TS client)
  registered; `generator` capability exposed

**GEN-007..012 — Generator Pipeline + Control API (complete).** The governed
generate→apply pipeline that gives the Publish/Review flow meaning:

- **GEN-007 Preview + Diff** — artifact set diffed against a target directory
  (create/update/unchanged), line counts, previewHash
- **GEN-008 Validation pipeline** — path-safety (`../`, absolute paths),
  max size/count, required files, `noRawSecrets` rule; validates before any
  preview/apply
- **GEN-009 Governed Apply** — `ArtifactApplyPort` is the only path to the
  filesystem; generators never call `fs.writeFile`. Apply requires policy
  approval (`FORBIDDEN` when unapproved)
- **GEN-010 Verification + Evidence** — post-apply verification (files exist,
  hashes match), chained to the generation evidence
- **`GenerationService.applyFlow`** — `run → validate → preview → apply →
  verify` in one governed step
- **GEN-011 Control API** — `GET /api/v2/generator/generators|capabilities`,
  `POST .../plan|run|preview|apply` (33 OpenAPI paths total)
- **GEN-012 Builder contracts** — `GenerationReview`, `AppliedGenerationRecord`,
  `DiffLine`, review decision types for the future Builder UI

Agents, workflows, generators, database, Marketplace, and diagnostics are
**not** part of the current stream — the next streams are ONB (onboarding),
SYS (system/firmware), AUTH-007+ (OAuth), API2-004+ (compat). PostgreSQL/
Redis/NATS/Prisma and external runtimes stay behind ports; the API boots and
passes tests without them.

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
