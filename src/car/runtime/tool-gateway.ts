import { randomId } from '../../core/identifiers.js';
import type { ToolRuntime } from '../../tool/runtime/tool-runtime.js';
import type { ToolExecutionRecord } from '../../tool/domain/contracts.js';
import type { ApprovalRuntime } from '../../agent/approval/approval-runtime.js';

export interface ToolGatewayRequest {
  readonly runtimeId: string;
  readonly sessionId: string;
  readonly agentId: string;
  readonly toolId: string;
  readonly input: unknown;
  readonly principalId?: string;
}

export interface ToolGatewayResult {
  readonly ok: boolean;
  readonly output?: unknown;
  readonly error?: string;
  readonly approved: boolean;
  readonly approvalRequired: boolean;
  readonly execution?: ToolExecutionRecord;
}

/**
 * CAR-008/009 — Tool Gateway. External coding runtimes (OpenCode/Claude/Codex/
 * Gemini) request tools through here; Vestara owns authorization, approval and
 * evidence. A coding runtime can never become a backdoor around Tool Runtime,
 * Permission, Approvals or Evidence.
 */
export class ToolGateway {
  private readonly tools: ToolRuntime;
  private readonly approvals: ApprovalRuntime | undefined;

  constructor(options: { tools: ToolRuntime; approvals?: ApprovalRuntime }) {
    this.tools = options.tools;
    this.approvals = options.approvals;
  }

  async execute(request: ToolGatewayRequest): Promise<ToolGatewayResult> {
    const agentId = request.agentId;
    const runId = `car:${request.runtimeId}:${request.sessionId}`;
    const principalId = request.principalId ?? `agent:${agentId}`;
    try {
      const result = await this.tools.execute(agentId, runId, request.toolId, request.input, { principalId });
      return {
        ok: result.ok,
        ...(result.output !== undefined ? { output: result.output } : {}),
        ...(result.error !== undefined ? { error: result.error } : {}),
        approved: true,
        approvalRequired: false,
      };
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('requires human approval')) {
        // Register a pending approval so the Activity Room can render it.
        let approvalId: string | undefined;
        if (this.approvals) {
          const record: ToolExecutionRecord = {
            executionId: randomId('tool'),
            toolId: request.toolId,
            runId,
            agentId,
            capability: request.toolId,
            principalId,
            risk: 'control',
            approvalRequired: true,
            approved: false,
            status: 'suspended',
            startedAt: new Date().toISOString(),
            input: request.input,
          };
          const approval = this.approvals.register(record, `Approve ${request.toolId}`);
          approvalId = approval.id;
        }
        return {
          ok: false,
          error: message,
          approved: false,
          approvalRequired: true,
          ...(approvalId !== undefined ? { execution: { executionId: approvalId } as ToolExecutionRecord } : {}),
        };
      }
      return { ok: false, error: message, approved: false, approvalRequired: false };
    }
  }
}
