import { conflict, notFound } from '../../core/errors.js';
import type { AgentDefinition } from '../domain/contracts.js';

/**
 * AGENT-002 — Agent registry. Agents are declarative definitions. The canonical
 * set is Planner/Developer/Reviewer/Verifier/Observer; module specialists are
 * composed by attaching skills rather than defining near-identical agents.
 */
export class AgentRegistry {
  private readonly agents = new Map<string, AgentDefinition>();

  register(agent: AgentDefinition): void {
    if (this.agents.has(agent.id)) throw conflict(`Agent "${agent.id}" already registered`);
    this.agents.set(agent.id, agent);
  }

  get(id: string): AgentDefinition {
    const agent = this.agents.get(id);
    if (!agent) throw notFound(`Agent "${id}" not found`);
    return agent;
  }

  has(id: string): boolean {
    return this.agents.has(id);
  }

  list(): readonly AgentDefinition[] {
    return [...this.agents.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  listByRole(role: AgentDefinition['role']): readonly AgentDefinition[] {
    return this.list().filter((a) => a.role === role);
  }
}
