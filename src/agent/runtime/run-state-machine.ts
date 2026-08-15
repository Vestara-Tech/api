import { badRequest } from '../../core/errors.js';
import type { AgentRun, AgentRunEvent, AgentRunStatus } from '../domain/contracts.js';

const TRANSITIONS: Readonly<Record<AgentRunStatus, readonly AgentRunStatus[]>> = {
  queued: ['preparing', 'cancelled'],
  preparing: ['running', 'failed', 'cancelled'],
  running: ['running', 'waiting-for-tool', 'waiting-for-approval', 'suspended', 'completed', 'failed', 'cancelled'],
  'waiting-for-tool': ['running', 'suspended', 'cancelled'],
  'waiting-for-approval': ['running', 'suspended', 'cancelled', 'failed'],
  suspended: ['running', 'cancelled', 'failed'],
  completed: [],
  failed: [],
  cancelled: [],
};

/**
 * AGENT-004 — Agent run state machine. Runs progress through explicit states;
 * `waiting-for-approval` is first-class so risk-gated tool calls can suspend.
 */
export class AgentRunStateMachine {
  private readonly runs = new Map<string, AgentRun>();
  private readonly events = new Map<string, AgentRunEvent[]>();

  create(agentId: string): AgentRun {
    const run: AgentRun = { id: `run_${agentId}_${Date.now().toString(36)}`, agentId, status: 'queued' };
    this.runs.set(run.id, run);
    return run;
  }

  get(id: string): AgentRun {
    const run = this.runs.get(id);
    if (!run) throw badRequest(`Agent run "${id}" not found`);
    return run;
  }

  transition(runId: string, to: AgentRunStatus, patch?: Partial<AgentRun>): AgentRun {
    const run = this.get(runId);
    const allowed = TRANSITIONS[run.status];
    if (!allowed.includes(to)) {
      throw badRequest(`Invalid AgentRun transition: ${run.status} → ${to}`);
    }
    const next: AgentRun = { ...run, ...patch, status: to };
    this.runs.set(runId, next);
    return next;
  }

  list(agentId?: string): readonly AgentRun[] {
    const all = [...this.runs.values()].sort((a, b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? ''));
    return agentId !== undefined ? all.filter((r) => r.agentId === agentId) : all;
  }

  emit(event: AgentRunEvent): void {
    const list = this.events.get(event.runId) ?? [];
    list.push(event);
    this.events.set(event.runId, list);
  }

  eventsFor(runId: string): readonly AgentRunEvent[] {
    return this.events.get(runId) ?? [];
  }
}
