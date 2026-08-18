# DEX-ADR-001: Agent Execution Context Architecture

**Status:** Accepted
**Date:** 2026-08-18
**Checkpoint:** DEX-CP1

## Context

Vestara agents execute through coding runtimes (OpenCode, Codex, Claude Code, Gemini CLI). Each execution requires a context bundle: system instructions, resolved skills, available tools, permissions, and provenance metadata. Currently, `assembleAgentContext()` in `src/agent/context/context-assembler.ts` produces this bundle, but it operates on raw `assignedSkills: string[]` — just skill IDs with no resolution, validation, or provenance tracking.

The DEX roadmap needs a context architecture that:

1. Resolves skill IDs into execution-ready instructions and resources
2. Tracks where each context element came from (provenance)
3. Supports context budgeting (token limits, priority ordering)
4. Remains runtime-neutral (works for OpenCode, Codex, Claude Code, Gemini CLI)
5. Separates format validation (load time) from runtime requirements (connection time)

## Decision

### Context Layers

The execution context is built in three layers, each owned by a distinct module:

```
┌─────────────────────────────────────────────┐
│  Layer 3: Runtime Context (CAR Module)      │
│  - Runtime-specific formatting              │
│  - Token budget enforcement                 │
│  - Runtime adapter mapping                  │
├─────────────────────────────────────────────┤
│  Layer 2: Execution Context (Agent Module)  │
│  - Resolved skills (DEX-CP1 output)         │
│  - Tool descriptions                        │
│  - Permissions                              │
│  - Provenance metadata                      │
├─────────────────────────────────────────────┤
│  Layer 1: Skill Resolution (Skill Module)   │
│  - SkillSelector[] → ResolvedExecutionSkill │
│  - Role compatibility validation            │
│  - Capability requirement validation        │
│  - Deterministic ordering                   │
└─────────────────────────────────────────────┘
```

**Ownership:**
- Skill Module owns Layer 1 (resolution, validation, ordering)
- Agent Module owns Layer 2 (context assembly, provenance)
- CAR Module owns Layer 3 (runtime formatting, budgeting)

### Required vs Optional Context

| Element | Required | Source |
|---------|----------|--------|
| Agent instructions | Yes | AgentDefinition |
| Resolved skills | No | ExecutionSkillResolver |
| Tool descriptions | Yes | ToolRegistry |
| Permissions | Yes | AgentDefinition |
| Goal | No | Caller-provided |
| Provenance | Yes | Resolver output |

### Provenance Model

Every context element carries provenance: where it came from and how it was resolved.

```ts
interface ContextProvenance {
  readonly source: 'agent-definition' | 'skill-registry' | 'tool-registry' | 'caller';
  readonly resolvedAt: string;
  readonly skillId?: string;    // for skill-sourced elements
  readonly version?: string;
}
```

### Budgeting and Selection

Context budgeting is deferred to DEX-CP3 (Developer Runtime). The contract established here produces a resolved context that can be budgeted later:

1. Skills are resolved and ordered deterministically (by id)
2. Total instruction length is computed
3. CP3 can truncate, prioritize, or split based on token limits

### Runtime-Neutral Serialization

The resolved context is serialized as a plain object tree — no runtime-specific formatting. Runtime adapters (OpenCode, Codex, etc.) in Layer 3 transform this into runtime-specific formats.

This boundary ensures:
- Skill resolution logic is testable without a running runtime
- Context assembly is testable without runtime dependencies
- Runtime adapters only handle formatting, not resolution

## Consequences

### What becomes possible
- CP2 can replace `assignedSkills: string[]` with `ResolvedExecutionSkill[]`
- CP3 can enforce token budgets on resolved context
- Activity Room can display which skills contributed to execution context
- VCTRL can track skill provenance in execution evidence

### What is explicitly deferred
- Token-level budgeting (CP3)
- Runtime-specific context formatting (CP3)
- Dynamic skill loading at runtime (future)
- Skill version negotiation (future)

### Invariants maintained
- `assembleAgentContext()` is NOT redesigned in CP1 — only the input contract changes
- Skill resolution is deterministic (same inputs → same outputs)
- Missing required skills produce diagnostics, not exceptions
- Optional missing skills are silently skipped with diagnostics

## Proof

DEX-CP1 demonstrates:
- `ExecutionSkillResolver` resolves `SkillSelector[]` → `ResolvedExecutionSkill[]`
- 14 tests cover resolution, role validation, capability validation, ordering, diagnostics
- Output contract is ready for CP2 consumption
- No changes to `assembleAgentContext()` — input contract only
