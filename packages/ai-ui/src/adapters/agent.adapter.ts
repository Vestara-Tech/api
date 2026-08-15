import type { AgentActivityPart, ApprovalPart, ToolCallPart, ToolResultPart, WorkflowPart, VestaraMessagePart } from '../model/message';

/** Shape of the backend AgentRunEvent (normalized across runtimes). */
export interface AgentRunEventShape {
  readonly runId: string;
  readonly type: string;
  readonly at: string;
  readonly data?: unknown;
}

/**
 * agent.adapter — maps AgentRunEvents (started, tool-call, tool-result, step,
 * approval-requested, completed, failed, ...) into Activity Room message parts.
 */
export function agentEventToParts(event: AgentRunEventShape, agentName: string): VestaraMessagePart[] {
  const data = event.data as Record<string, unknown> | undefined;
  switch (event.type) {
    case 'started':
      return [{ kind: 'agent-activity', agentId: (data?.agentId as string) ?? '', agentName, activity: 'started' }];
    case 'step':
      return [{ kind: 'agent-activity', agentId: (data?.agentId as string) ?? '', agentName, activity: 'working', detail: `step ${String(data?.step ?? '')}` }];
    case 'tool-call': {
      const call = data as { tool?: string; arguments?: string } | undefined;
      return [{
        kind: 'tool-call',
        toolCallId: `tc_${event.runId}_${String(data?.tool ?? '')}`,
        name: call?.tool ?? 'tool',
        arguments: call?.arguments ? parseJson(call.arguments) : undefined,
        status: 'running',
      } as ToolCallPart];
    }
    case 'tool-result': {
      const result = data as { tool?: string; result?: string } | undefined;
      return [{
        kind: 'tool-result',
        toolCallId: `tc_${event.runId}_${String(data?.tool ?? '')}`,
        ok: true,
        output: result?.result ? parseJson(result.result) : undefined,
      } as ToolResultPart];
    }
    case 'approval-requested': {
      const approval = data as { tool?: string } | undefined;
      return [{
        kind: 'approval',
        approvalId: `aprv_${event.runId}_${String(approval?.tool ?? '')}`,
        toolId: approval?.tool ?? 'tool',
        subject: `Approve ${approval?.tool ?? 'tool'}`,
        risk: 'medium',
        status: 'pending',
      } as ApprovalPart];
    }
    case 'completed':
      return [{ kind: 'agent-activity', agentId: (data?.agentId as string) ?? '', agentName, activity: 'completed' }];
    case 'failed':
      return [{ kind: 'agent-activity', agentId: (data?.agentId as string) ?? '', agentName, activity: 'failed', detail: String((data?.error as string) ?? '') }];
    default:
      return [];
  }
}

export function workflowToPart(wf: { workflowId: string; runId?: string; stage: string; status: string }): WorkflowPart {
  return {
    kind: 'workflow',
    workflowId: wf.workflowId,
    ...(wf.runId !== undefined ? { runId: wf.runId } : {}),
    stage: wf.stage,
    status: wf.status,
  };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}
