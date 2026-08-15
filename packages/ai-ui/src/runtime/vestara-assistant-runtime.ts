import type { AiGenerateRequest, AiStreamEvent } from '../api/contracts';

export interface VestaraAssistantRuntimeOptions {
  readonly apiBase: string;
}

export interface StreamCallbacks {
  onChunk(text: string): void;
  onToolCall?(call: { id: string; name: string; arguments: unknown }): void;
  onDone?(modelId: string, providerId: string): void;
  onError(message: string): void;
}

/**
 * vestara-assistant-runtime — the presentation/runtime adapter. The UI talks
 * to this; Vestara intelligence, orchestration and governance stay server-side
 * behind /api/v2/ai/* and /api/v2/approvals/*. No provider knowledge leaks in.
 */
export class VestaraAssistantRuntime {
  private readonly apiBase: string;

  constructor(options: VestaraAssistantRuntimeOptions) {
    this.apiBase = options.apiBase;
  }

  async stream(request: AiGenerateRequest, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<void> {
    const response = await fetch(`${this.apiBase}/api/v2/ai/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      ...(signal !== undefined ? { signal } : {}),
    });
    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => '');
      callbacks.onError(`Stream failed: ${response.status} ${text.slice(0, 200)}`);
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const raw of events) {
          const line = raw.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          const payload = line.slice(6);
          if (!payload) continue;
          let event: AiStreamEvent;
          try {
            event = JSON.parse(payload) as AiStreamEvent;
          } catch {
            continue;
          }
          this.dispatch(event, callbacks);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async approve(approvalId: string, principalId: string): Promise<{ status: string; decidedBy: string }> {
    const response = await fetch(`${this.apiBase}/api/v2/approvals/${approvalId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ principalId }),
    });
    if (!response.ok) throw new Error(`Approve failed: ${response.status}`);
    return response.json() as Promise<{ status: string; decidedBy: string }>;
  }

  async reject(approvalId: string, principalId: string): Promise<{ status: string; decidedBy: string }> {
    const response = await fetch(`${this.apiBase}/api/v2/approvals/${approvalId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ principalId }),
    });
    if (!response.ok) throw new Error(`Reject failed: ${response.status}`);
    return response.json() as Promise<{ status: string; decidedBy: string }>;
  }

  private dispatch(event: AiStreamEvent, callbacks: StreamCallbacks): void {
    switch (event.type) {
      case 'chunk':
        callbacks.onChunk(event.text);
        break;
      case 'tool-call':
        callbacks.onToolCall?.({
          id: event.toolCall.id,
          name: event.toolCall.name,
          arguments: safeParse(event.toolCall.arguments),
        });
        break;
      case 'done':
        callbacks.onDone?.(event.modelId, event.providerId);
        break;
      case 'error':
        callbacks.onError(event.message);
        break;
    }
  }
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}
