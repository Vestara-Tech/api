import type { AgentDefinition, AgentRun } from '../domain/contracts.js';

export interface AgentContextInput {
  readonly agent: AgentDefinition;
  readonly run: AgentRun;
  readonly goal?: string;
  readonly assignedSkills: readonly string[];
  readonly toolDescriptions: readonly string[];
}

export interface AssembledAgentContext {
  readonly system: string;
  readonly runSummary: string;
  readonly availableTools: string;
  readonly skillsSummary: string;
  readonly permissions: readonly string[];
}

/**
 * AGENT-006 — Context assembly. Builds the execution environment:
 * agent instructions + assigned skills + available tools + permissions.
 */
export function assembleAgentContext(input: AgentContextInput): AssembledAgentContext {
  const { agent, run, goal, assignedSkills, toolDescriptions } = input;
  const guardrails = (agent.instructions.guardrails ?? []).map((g) => `- ${g}`).join('\n');
  const skillsSummary = assignedSkills.length > 0 ? assignedSkills.join(', ') : 'none assigned';

  const system = [
    agent.instructions.system,
    goal ? `Goal: ${goal}` : '',
    guardrails ? `Guardrails:\n${guardrails}` : '',
    `Skills in use: ${skillsSummary}`,
    `Available tools: ${toolDescriptions.join(', ')}`,
    `Your permissions: ${agent.permissions.join(', ')}`,
  ]
    .filter((s) => s.length > 0)
    .join('\n\n');

  return {
    system,
    runSummary: `Run ${run.id} (${run.status})`,
    availableTools: toolDescriptions.join(', '),
    skillsSummary,
    permissions: agent.permissions,
  };
}
