# ADR-0019 — Coding Agent Runtime (CAR foundation)

- Status: accepted
- Date: 2026-08-15
- Applies to: CAR foundation

## Context

OpenCode, Claude Code, OpenAI Codex and Gemini are not merely model providers —
they are agent execution engines with their own loops, sessions, tools,
repository context, filesystem operations and lifecycle semantics. They must
not become four new Vestara agent architectures, and their SDKs must not leak
into the core.

## Decision

External coding runtimes are normalized behind a single `CodingAgentRuntime`
contract; Vestara remains the owner of tools, permissions, approvals and
evidence.

### 1. One contract, many engines

`CodingAgentRuntime` (capabilities, createSession, resumeSession, execute,
cancel, close) normalizes OpenCode, Claude Code, Codex, Gemini and the native
Vestara runtime. `CodingAgentRuntimeRegistry` holds them; provider SDKs never
escape adapter directories. No `if (runtime === "codex")` business logic in
Vestara.

### 2. Capability discovery + selection + fallback

`RuntimeSelector` resolves an `AgentRuntimePolicy` (vestara | auto | explicit +
fallback + requirements) to a runtime by matching declared capabilities.
Fallback preserves capability requirements and lands on the native Vestara
runtime rather than failing.

### 3. The Tool Gateway keeps governance Vestara-owned

External runtimes request tools through `ToolGateway`; authorization, approval
and evidence stay in Tool Runtime / Permission / Approval. A coding runtime can
never become a backdoor around governance. Control-risk tools return
`approval-required` and register a pending approval the Activity Room renders.

### 4. OpenCode is the reference adapter

`OpenCodeAdapter` targets the stable server/client HTTP integration with plain
fetch (no vendor SDK). When the server is unreachable it degrades honestly to a
local session id rather than blocking execution. The embedded V2 runtime can
swap in later without changing the contract.

### 5. Agents can select a runtime

`AgentDefinition.runtimePolicy` lets a Vestara agent declare
`runtime: "auto"` with requirements; the developer agent does this. Vestara
creates a Vestara agent, not an "OpenCode agent" — OpenCode is one execution
engine.

## Consequences

- CAR foundation complete: contract, registry, selector (auto/fallback/
  capability matching), Tool Gateway, native + OpenCode + memory adapters,
  `AgentRuntimePolicy` on `AgentDefinition`, control API
  (`/api/v2/car/*`), capability `car`.
- 8 tests (registry, selection, fallback, health, gateway governance, OpenCode
  degradation). 424 total.
- CAR-012..014 (Claude Code/Codex/Gemini adapters), CAR-015..020 (session
  persistence, cancellation, telemetry, config, credential bridge) follow.
