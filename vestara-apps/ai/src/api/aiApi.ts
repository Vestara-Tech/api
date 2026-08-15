import type { AiGenerateRequest, AiStreamEvent } from '@vestara/ai-ui/src/api/contracts';

export interface AgentRunEventShape {
  readonly runId: string;
  readonly type: string;
  readonly at: string;
  readonly data?: unknown;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...init, headers });
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const err = body as { error?: { message?: string } } | null;
    throw new Error(err?.error?.message ?? `HTTP ${response.status}`);
  }
  return body as T;
}

export const aiApi = {
  agents: () => request<{ id: string; name: string; role: string }[]>('/api/v2/agents'),

  startAgentRun: (agentId: string, goal: string, principalId?: string) =>
    request<{ id: string; agentId: string; status: string }>('/api/v2/agent-runs', {
      method: 'POST',
      body: JSON.stringify({ agentId, goal, ...(principalId !== undefined ? { principalId } : {}) }),
    }),

  agentRunEvents: (runId: string) => request<readonly AgentRunEventShape[]>(`/api/v2/agent-runs/${runId}/events`),

  approvals: () =>
    request<{ id: string; runId: string; agentId: string; toolId: string; subject: string; risk: string; status: string }[]>('/api/v2/approvals'),

  generate: (body: AiGenerateRequest) => request<{ content: string }>('/api/v2/ai/generate', { method: 'POST', body: JSON.stringify(body) }),

  stream: (body: AiGenerateRequest, onEvent: (event: AiStreamEvent) => void): Promise<void> =>
    fetch('/api/v2/ai/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async (response) => {
      if (!response.ok || !response.body) throw new Error(`stream failed: ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
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
          try {
            onEvent(JSON.parse(payload) as AiStreamEvent);
          } catch {
            // ignore malformed
          }
        }
      }
    }),
};
