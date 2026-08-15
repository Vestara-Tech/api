# ADR-0014 — Agent Platform (AGENT-001..006 + TOOL-001..005 + SKILL-001..005)

- Status: accepted
- Date: 2026-08-15
- Applies to: AGENT-001 — AGENT-006, TOOL-001 — TOOL-005, SKILL-001 — SKILL-005

## Context

Vestara modules each have capabilities (API Definition, Generator, System,
Image Builder, ...). Agents need to use them, but an agent must never import
another module's internal implementation. Without a boundary, agents become
tightly coupled to every module and gain unrestricted mutation paths.

## Decision

Six concepts stay separate:

**Agent = identity + role + policies + runtime. Tool = governed executable
capability. Skill = reusable procedural knowledge. AI = reasoning/inference.
Workflow = orchestration. Module/service = actual platform capability.**

### 1. Agents orchestrate capabilities; tools expose capabilities

`AgentDefinition` is declarative: id, role, model policy, instructions, tool
selectors, skill selectors, permissions, execution policy. The canonical set is
Planner/Developer/Reviewer/Verifier/Observer; specialists are composed from
these plus skills, never duplicated as near-identical agents.

### 2. Tool Registry discovers contributions

Each module optionally exposes a `ToolContributor`. The API Builder module
contributes `api.definition.read/get/create/validate/preview` as tools
(capability bridge). A future Marketplace package can contribute tools without
modifying the Agent runtime.

### 3. Tool execution is governed

`ToolRuntime` pipeline: resolve → validate input → check agent permission →
check capability → evaluate risk (`ToolPolicy`: read/write auto-approve;
control/privileged/critical require approval) → execute → validate output →
audit record + evidence hash. Every call produces a `ToolExecutionRecord`.
AI never bypasses the capability policy; `waiting-for-approval` is a first-class
run state.

### 4. Skills are portable packages

`skill.json` + `SKILL.md` + resources. `SkillLoader` reads packages from disk;
`SkillRegistry` validates on register; `SkillResolver` checks that an agent's
capabilities satisfy a skill's required capabilities and composes instructions.
Skills compose: Developer + api-builder skill = API developer.

### 5. Run lifecycle

`AgentRun` state machine: queued → preparing → running ⇄ waiting-for-tool /
waiting-for-approval / suspended → completed / failed / cancelled. Context
assembly binds agent instructions + skills + tools + permissions. The AI
Runtime (`AiService`) is the reasoning engine; the Agent runtime never talks to
a provider directly.

### 6. Generate ≠ Write survives agent automation

Agents get `generator.run/preview/apply` style tools; apply remains governed by
the consuming module's governance.

## Consequences

- Foundation complete: agent contracts + registry + 5 canonical agents; tool
  contracts + registry + runtime + policy + audit/evidence; skill contracts +
  manifest + loader + registry + validation + resolution. 11 tests added (323
  total), registered as capability `agents`.
- AGENT-007+ (tool-call loop, streaming events, cancellation/resume,
  delegation), AGENT-013..018 (generator/config/system/image/auth tools),
  AGENT-024+ (control API, OpenAPI, UIs) follow in later milestones.
