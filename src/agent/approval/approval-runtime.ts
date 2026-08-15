import { randomId } from '../../core/identifiers.js';
import type { AgentRun } from '../domain/contracts.js';
import type { AgentRunStateMachine } from '../runtime/run-state-machine.js';
import type { AgentRuntime } from '../runtime/agent-runtime.js';
import type { ToolRuntime } from '../../tool/runtime/tool-runtime.js';
import type { ToolExecutionRecord } from '../../tool/domain/contracts.js';

export interface PendingApproval {
  readonly id: string;
  readonly runId: string;
  readonly agentId: string;
  readonly toolId: string;
  readonly input: unknown;
  readonly subject: string;
  readonly risk: string;
  readonly requestedAt: string;
  readonly status: 'pending' | 'approved' | 'rejected';
  readonly decidedAt?: string;
  readonly decidedBy?: string;
}

export interface ApprovalRuntimeOptions {
  readonly agents: AgentRuntime;
  readonly runs: AgentRunStateMachine;
  readonly tools: ToolRuntime;
}

/**
 * Approval bridge. The UI renders a pending approval; a human decision flows
 * back through here: approve → execute the tool with approval + authorizer,
 * resume the agent run, record evidence. AI never bypasses this gate.
 */
export class ApprovalRuntime {
  private readonly agents: AgentRuntime;
  private readonly runs: AgentRunStateMachine;
  private readonly tools: ToolRuntime;
  private readonly pending = new Map<string, PendingApproval>();

  constructor(options: ApprovalRuntimeOptions) {
    this.agents = options.agents;
    this.runs = options.runs;
    this.tools = options.tools;
  }

  /** Record a suspended tool execution as a pending approval (called by the tool gateway). */
  register(record: ToolExecutionRecord, subject: string): PendingApproval {
    const approval: PendingApproval = {
      id: randomId('aprv'),
      runId: record.runId,
      agentId: record.agentId,
      toolId: record.toolId,
      input: record.input,
      subject,
      risk: record.risk,
      requestedAt: new Date().toISOString(),
      status: 'pending',
    };
    this.pending.set(approval.id, approval);
    return approval;
  }

  list(): readonly PendingApproval[] {
    return [...this.pending.values()].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }

  get(id: string): PendingApproval | undefined {
    return this.pending.get(id);
  }

  async approve(id: string, principalId: string): Promise<PendingApproval> {
    const approval = this.requirePending(id);
    // Execute the tool with explicit approval + authorizer, then resume the run.
    const result = await this.tools.execute(approval.agentId, approval.runId, approval.toolId, approval.input, {
      approved: true,
      principalId: `agent:${approval.agentId}`,
      authorizedBy: principalId,
    });
    const decided: PendingApproval = {
      ...approval,
      status: 'approved',
      decidedAt: new Date().toISOString(),
      decidedBy: principalId,
    };
    this.pending.set(id, decided);
    this.resumeIfNeeded(approval.runId, result.ok ? undefined : result.error);
    return decided;
  }

  async reject(id: string, principalId: string): Promise<PendingApproval> {
    const approval = this.requirePending(id);
    const decided: PendingApproval = {
      ...approval,
      status: 'rejected',
      decidedAt: new Date().toISOString(),
      decidedBy: principalId,
    };
    this.pending.set(id, decided);
    // Feed a denial back into the run so the agent can adjust.
    this.tools.execute(approval.agentId, approval.runId, approval.toolId, approval.input, {
      approved: false,
      principalId: `agent:${approval.agentId}`,
      authorizedBy: principalId,
    }).catch(() => undefined);
    this.resumeIfNeeded(approval.runId, `Tool "${approval.toolId}" was rejected by ${principalId}`);
    return decided;
  }

  private requirePending(id: string): PendingApproval {
    const approval = this.pending.get(id);
    if (!approval) throw new Error(`Approval "${id}" not found`);
    if (approval.status !== 'pending') throw new Error(`Approval "${id}" already ${approval.status}`);
    return approval;
  }

  private resumeIfNeeded(runId: string, error?: string): void {
    let run: AgentRun;
    try {
      run = this.runs.get(runId);
    } catch {
      return;
    }
    if (run.status === 'waiting-for-approval' || run.status === 'suspended') {
      this.agents.resume(runId);
    }
  }
}
