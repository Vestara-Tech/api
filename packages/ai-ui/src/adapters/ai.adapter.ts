import type { AiStreamEvent } from '../api/contracts';
import type { ApprovalPart, ToolCallPart, ToolResultPart } from '../model/message';

/**
 * ai.adapter — maps the normalized AiStreamEvent vocabulary from the Vestara
 * SSE stream into assistant message parts.
 */
export function streamEventToParts(event: AiStreamEvent): { parts: (ToolCallPart | ToolResultPart)[]; text: string; done: boolean; error?: string } {
  switch (event.type) {
    case 'chunk':
      return { parts: [], text: event.text, done: false };
    case 'tool-call':
      return {
        parts: [{
          kind: 'tool-call',
          toolCallId: event.toolCall.id,
          name: event.toolCall.name,
          arguments: parseJson(event.toolCall.arguments),
          status: 'pending',
        }],
        text: '',
        done: false,
      };
    case 'done':
      return { parts: [], text: '', done: true };
    case 'error':
      return { parts: [], text: '', done: true, error: event.message };
  }
}

export function approvalToPart(approval: { id: string; toolId: string; subject: string; risk: string; status: string }): ApprovalPart {
  return {
    kind: 'approval',
    approvalId: approval.id,
    toolId: approval.toolId,
    subject: approval.subject,
    risk: approval.risk,
    status: approval.status as ApprovalPart['status'],
  };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}
