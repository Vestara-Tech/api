/**
 * ARX-014 — Agent step dispatch boundary.
 *
 * Sits between WorkflowRuntime and the two execution paths:
 *
 *   WorkflowRuntime
 *         ↓
 *   AgentStepExecutor
 *         │
 *         ├── governed coding runtime → DeveloperExecutionCoordinator → CAR
 *         │   (agent has runtimePolicy with coding requirements)
 *         │
 *         └── standard agent          → AgentRuntime → AI
 *             (no runtimePolicy or non-coding policy)
 *
 * This keeps WorkflowRuntime generic: it does not understand CAR policy,
 * runtime selection, or session management. The decision is made here by
 * inspecting the resolved AgentDefinition.runtimePolicy.
 *
 * Future Codex/Claude/Gemini runtime routing logic accumulates HERE,
 * not in WorkflowRuntime.
 */

import type { AgentRegistry } from '../../agent/registry/agent-registry.js';
import type { AgentRuntime, AgentRunInput } from '../../agent/runtime/agent-runtime.js';
import type { RuntimeSelector } from '../../car/runtime/runtime-selector.js';
import type { CodingAgentRuntimeRegistry } from '../../car/registry/coding-agent-runtime-registry.js';
import type { DeveloperExecutionCoordinator } from '../../car/runtime/developer-execution-coordinator.js';
import type { WorkflowSessionContext } from '../../car/runtime/runtime-session-registry.js';
import { CapacityExhaustedError } from '../../car/runtime/runtime-session-registry.js';
import type { CodingAgentEvent } from '../../car/domain/contracts.js';
import type { AgentDefinition } from '../../agent/domain/contracts.js';

export interface AgentStepExecutorResult {
  readonly agentRunId?: string;
  readonly outcome: 'completed' | 'failed' | 'queued';
  readonly events: readonly CodingAgentEvent[];
  readonly sessionId?: string;
  readonly error?: string;
}

export interface AgentStepExecutorInput {
  readonly agentId: string;
  readonly goal: string;
  readonly principalId?: string;
  readonly workflowRunId: string;
  readonly agentAssignmentId?: string;
  readonly executionId: string;
  readonly repositoryRoot?: string;
}

export interface AgentStepExecutorDeps {
  readonly agents: AgentRegistry;
  readonly agentRuntime: AgentRuntime;
  readonly selector: RuntimeSelector;
  readonly registry: CodingAgentRuntimeRegistry;
  readonly coordinator: DeveloperExecutionCoordinator;
}

/**
 * ARX-014 — Determine whether an agent definition requires a governed
 * coding runtime (CAR) or should use the standard AI agent loop.
 *
 * An agent needs CAR when:
 *   1. It has a runtimePolicy with coding requirements, AND
 *   2. The runtime policy's requirements include repositoryEditing or terminal
 *
 * Non-coding agents (planner, reviewer, verifier, observer) use the
 * standard AgentRuntime AI loop.
 */
function requiresCodingRuntime(agent: AgentDefinition): boolean {
  const policy = agent.runtimePolicy;
  if (policy === undefined) return false;
  const reqs = policy.requirements;
  if (reqs === undefined) return false;
  return Boolean(reqs.repositoryEditing) || Boolean(reqs.terminal);
}

export class AgentStepExecutor {
  private readonly deps: AgentStepExecutorDeps;

  constructor(deps: AgentStepExecutorDeps) {
    this.deps = deps;
  }

  /**
   * Execute a workflow agent step through the appropriate runtime path.
   *
   * For coding agents (those with runtimePolicy requiring repository editing
   * or terminal access): route through DeveloperExecutionCoordinator → CAR.
   *
   * For non-coding agents: route through AgentRuntime → AI.
   */
  async execute(input: AgentStepExecutorInput): Promise<AgentStepExecutorResult> {
    const agent = this.deps.agents.get(input.agentId);

    if (requiresCodingRuntime(agent)) {
      return this.executeCodingAgent(input, agent);
    }

    return this.executeStandardAgent(input);
  }

  /**
   * Route through the governed coding runtime (CAR).
   *
   * The DeveloperExecutionCoordinator handles:
   *   - session lifecycle (create/resume via registry)
   *   - context assembly
   *   - execute → verify → evidence
   *   - bounded fix loop with session reuse
   */
  private async executeCodingAgent(
    input: AgentStepExecutorInput,
    agent: AgentDefinition,
  ): Promise<AgentStepExecutorResult> {
    try {
      const selected = await this.deps.selector.select(agent.runtimePolicy ?? { runtime: 'auto' });
      const adapter = this.deps.registry.get(selected.runtimeId);
      if (adapter === undefined) {
        return { outcome: 'failed', events: [], error: `Runtime "${selected.runtimeId}" not registered` };
      }

      const workflowContext: WorkflowSessionContext | undefined =
        input.agentAssignmentId !== undefined
          ? {
              workflowRunId: input.workflowRunId,
              agentAssignmentId: input.agentAssignmentId,
              runtimeId: selected.runtimeId,
            }
          : undefined;

      const result = await this.deps.coordinator.execute(
        {
          executionId: input.executionId,
          agentId: input.agentId,
          goal: input.goal,
          roomId: 'workflow',
          ...(input.principalId !== undefined ? { principalId: input.principalId } : {}),
          ...(input.repositoryRoot !== undefined ? { repository: { root: input.repositoryRoot } } : {}),
          ...(workflowContext !== undefined ? { workflowContext } : {}),
        },
        adapter,
      );

      return {
        agentRunId: result.executionId,
        outcome: result.outcome === 'completed' ? 'completed' : 'failed',
        events: result.events,
        ...(result.sessionId !== undefined ? { sessionId: result.sessionId } : {}),
        ...(result.error !== undefined ? { error: result.error } : {}),
      };
    } catch (error) {
      // ARX-014 — Capacity exhaustion returns a governed state (queued), not an exception.
      if (error instanceof CapacityExhaustedError) {
        return { outcome: 'queued', events: [], error: error.message };
      }
      return {
        outcome: 'failed',
        events: [],
        error: (error as Error).message,
      };
    }
  }

  /**
   * Route through the standard AgentRuntime AI loop.
   *
   * This is the legacy path: the agent runs through the AI tool-call
   * loop with ephemeral sessions. Used for planner, reviewer, verifier,
   * observer — agents that do not need a persistent coding session.
   */
  private executeStandardAgent(input: AgentStepExecutorInput): AgentStepExecutorResult {
    const runInput: AgentRunInput = {
      agentId: input.agentId,
      goal: input.goal,
      ...(input.principalId !== undefined ? { principalId: input.principalId } : {}),
    };
    const run = this.deps.agentRuntime.start(runInput);
    return {
      agentRunId: run.id,
      outcome: run.status === 'completed' || run.status === 'failed' ? run.status : 'completed',
      events: [],
    };
  }
}
