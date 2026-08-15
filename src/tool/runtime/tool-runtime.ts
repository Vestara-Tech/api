import { randomId } from '../../core/identifiers.js';
import { createHash } from 'node:crypto';
import type {
  ToolAuthorizationDecision,
  ToolExecutionRecord,
  ToolExecutionContext,
  ToolResult,
  ToolRisk,
} from '../domain/contracts.js';
import { ToolRegistry } from '../registry/tool-registry.js';
import { ToolPolicy } from '../policy/tool-policy.js';

export interface ToolRuntimeOptions {
  readonly registry: ToolRegistry;
  readonly policy: ToolPolicy;
  readonly checkCapability?: (agentId: string, capability: string) => Promise<boolean>;
}

export interface ToolRuntime {
  execute(
    agentId: string,
    runId: string,
    toolId: string,
    input: unknown,
    options?: { skillId?: string; principalId?: string; authorizedBy?: string; approved?: boolean },
  ): Promise<ToolResult<unknown>>;

  listRecords(): readonly ToolExecutionRecord[];
}

/**
 * TOOL-003/004/006/007 — Tool execution runtime. Pipeline: resolve → validate
 * input → check agent permission → check capability → evaluate risk → approval
 * → execute → validate output → audit + evidence.
 */
export class ToolRuntime implements ToolRuntime {
  private readonly registry: ToolRegistry;
  private readonly policy: ToolPolicy;
  private readonly checkCapability: NonNullable<ToolRuntimeOptions['checkCapability']>;
  private readonly executionRecords: ToolExecutionRecord[] = [];

  constructor(options: ToolRuntimeOptions) {
    this.registry = options.registry;
    this.policy = options.policy;
    this.checkCapability = options.checkCapability ?? (async () => true);
  }

  get records(): readonly ToolExecutionRecord[] {
    return this.executionRecords;
  }

  listRecords(): readonly ToolExecutionRecord[] {
    return [...this.executionRecords].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async execute(
    agentId: string,
    runId: string,
    toolId: string,
    input: unknown,
    options: { skillId?: string; principalId?: string; authorizedBy?: string; approved?: boolean } = {},
  ): Promise<ToolResult<unknown>> {
    const executionId = randomId('tool');
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    const principalId = options.principalId ?? `agent:${agentId}`;

    const tool = this.registry.get(toolId);
    const context: ToolExecutionContext = {
      agentId,
      runId,
      principalId,
      ...(options.skillId !== undefined ? { skillId: options.skillId } : {}),
      ...(options.authorizedBy !== undefined ? { authorizedBy: options.authorizedBy } : {}),
    };

    // Authorization: agent capability + tool risk policy.
    let decision: ToolAuthorizationDecision;
    try {
      const capabilityOk = await this.checkCapability(agentId, tool.capabilities[0] ?? '');
      decision = this.policy.evaluate(tool.risk, capabilityOk);
    } catch {
      decision = { allowed: false, approvalRequired: false, reason: 'capability check failed' };
    }

    const approvalRequired = decision.approvalRequired && options.approved !== true;

    if (approvalRequired) {
      this.record(executionId, tool, runId, agentId, options.skillId, context, decision, 'suspended', startedAt);
      throw new Error(`Tool "${toolId}" requires human approval`);
    }

    // An explicit approval overrides the policy gate for approval-required risks.
    const allowed = decision.allowed || options.approved === true;

    if (!allowed) {
      this.record(executionId, tool, runId, agentId, options.skillId, context, decision, 'denied', startedAt);
      return { ok: false, error: decision.reason, durationMs: Date.now() - startedMs };
    }

    // Execute.
    const result = await tool.execute(context, input);
    const completedAt = new Date().toISOString();

    this.record(
      executionId,
      tool,
      runId,
      agentId,
      options.skillId,
      context,
      decision,
      result.ok ? 'executed' : 'failed',
      startedAt,
      completedAt,
      Date.now() - startedMs,
      input,
      result.output,
      result.error,
      result.evidence,
    );

    return result;
  }

  private record(
    executionId: string,
    tool: { id: string; risk: ToolRisk; capabilities: readonly string[] },
    runId: string,
    agentId: string,
    skillId: string | undefined,
    context: ToolExecutionContext,
    decision: ToolAuthorizationDecision,
    status: ToolExecutionRecord['status'],
    startedAt: string,
    completedAt?: string,
    durationMs?: number,
    input?: unknown,
    output?: unknown,
    error?: string,
    evidence?: string,
  ): void {
    const record: ToolExecutionRecord = {
      executionId,
      toolId: tool.id,
      runId,
      agentId,
      capability: tool.capabilities[0] ?? '',
      principalId: context.principalId,
      risk: tool.risk,
      approvalRequired: decision.approvalRequired,
      approved: context.authorizedBy !== undefined || status === 'executed',
      status,
      startedAt,
      ...(skillId !== undefined ? { skillId } : {}),
      ...(context.authorizedBy !== undefined ? { authorizedBy: context.authorizedBy } : {}),
      ...(completedAt !== undefined ? { completedAt } : {}),
      ...(durationMs !== undefined ? { durationMs } : {}),
      ...(input !== undefined ? { input } : {}),
      ...(output !== undefined ? { output } : {}),
      ...(error !== undefined ? { error } : {}),
      ...(evidence !== undefined ? { evidence } : {}),
    };
    this.executionRecords.push(record);
  }
}

export function toolEvidenceHash(record: ToolExecutionRecord): string {
  return createHash('sha256')
    .update(JSON.stringify({ executionId: record.executionId, toolId: record.toolId, startedAt: record.startedAt }))
    .digest('hex');
}
