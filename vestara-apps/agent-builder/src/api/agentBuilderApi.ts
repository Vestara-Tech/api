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

export interface AgentView {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly role: string;
  readonly tools: readonly { id: string }[];
  readonly skills: readonly { id: string }[];
  readonly permissions: readonly string[];
}

export interface ToolView {
  readonly id: string;
  readonly version: string;
  readonly description: string;
  readonly capabilities: readonly string[];
  readonly risk: string;
}

export interface SkillView {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly description: string;
  readonly requiredCapabilities: readonly string[];
}

export interface CarRuntimeView {
  readonly id: string;
  readonly tools: boolean;
  readonly filesystem: boolean;
  readonly shell: boolean;
  readonly resumableSessions: boolean;
  readonly repositoryContext: boolean;
  readonly structuredOutput: boolean;
}

export const agentBuilderApi = {
  agents: () => request<readonly AgentView[]>('/api/v2/agents'),
  agent: (id: string) => request<AgentView>(`/api/v2/agents/${id}`),
  tools: () => request<readonly ToolView[]>('/api/v2/tools'),
  skills: () => request<readonly SkillView[]>('/api/v2/skills'),
  carRuntimes: () => request<readonly CarRuntimeView[]>('/api/v2/car/runtimes'),
  permissionDefs: () => request<readonly { id: string; resource: string; action: string; risk: string }[]>('/api/v2/permissions'),

  startRun: (agentId: string, goal: string) =>
    request<{ id: string; agentId: string; status: string }>('/api/v2/agent-runs', {
      method: 'POST',
      body: JSON.stringify({ agentId, goal, principalId: 'agent-builder-user' }),
    }),

  runEvents: (runId: string) => request<readonly { runId: string; type: string; at: string; data?: unknown }[]>(`/api/v2/agent-runs/${runId}/events`),
};
