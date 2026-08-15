import type { AgentRegistry } from '../../agent/registry/agent-registry.js';
import type { ContextCollectionRequest, ContextItem } from '../domain/contracts.js';
import type { ContextProvider } from './context-provider.js';

/**
 * CTX-015 — Agent context provider (the first adapter over the agent
 * definition, replacing the string-only assembleAgentContext).
 */
export class AgentContextProvider implements ContextProvider {
  readonly id = 'agent';
  readonly kinds = ['instruction', 'goal', 'skill', 'tool', 'system'] as const;
  readonly scope = 'agent';

  constructor(private readonly agents: AgentRegistry) {}

  async collect(request: ContextCollectionRequest): Promise<readonly ContextItem[]> {
    if (!request.agentId) return [];
    let agent;
    try {
      agent = this.agents.get(request.agentId);
    } catch {
      return [];
    }
    const guardrails = (agent.instructions.guardrails ?? []).join('\n');
    const items: ContextItem[] = [
      {
        id: `agent:${agent.id}:instructions`,
        source: 'instruction',
        sourceId: agent.id,
        title: 'Agent Instructions',
        content: `${agent.instructions.system}\n${guardrails ? `\nGuardrails:\n${guardrails}` : ''}`,
        priority: 100,
        required: true,
        sensitive: false,
        metadata: { scope: 'agent', role: agent.role },
      },
      {
        id: `agent:${agent.id}:tools`,
        source: 'tool',
        sourceId: agent.id,
        title: 'Available Tools',
        content: agent.tools.map((t) => t.id).join(', '),
        priority: 60,
        required: true,
        sensitive: false,
        metadata: { scope: 'agent' },
      },
      {
        id: `agent:${agent.id}:skills`,
        source: 'skill',
        sourceId: agent.id,
        title: 'Assigned Skills',
        content: agent.skills.map((s) => s.id).join(', '),
        priority: 50,
        required: true,
        sensitive: false,
        metadata: { scope: 'agent' },
      },
      {
        id: `agent:${agent.id}:permissions`,
        source: 'system',
        sourceId: agent.id,
        title: 'Permissions',
        content: agent.permissions.join(', '),
        priority: 90,
        required: true,
        sensitive: false,
        metadata: { scope: 'agent' },
      },
    ];
    if (request.task) {
      items.push({
        id: `agent:${agent.id}:task`,
        source: 'task',
        title: 'Current Task',
        content: request.task,
        priority: 95,
        required: true,
        sensitive: false,
        metadata: { scope: 'task' },
      });
    }
    return items;
  }
}
