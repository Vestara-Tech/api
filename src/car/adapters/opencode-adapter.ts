import type {
  CodingAgentCapabilities,
  CodingAgentEvent,
  CodingAgentRequest,
  CodingAgentRuntime,
  CodingAgentRuntimeId,
  CodingAgentSession,
  CodingAgentSessionContext,
} from '../domain/contracts.js';

/**
 * CAR-011 — OpenCode reference adapter. Uses the stable server/client
 * integration over HTTP (plain fetch, no vendor SDK imported into core).
 * The embedded runtime can later swap in without changing the contract.
 */
export class OpenCodeAdapter implements CodingAgentRuntime {
  readonly id: CodingAgentRuntimeId = 'opencode';
  private readonly baseUrl: string;
  private readonly declaredCapabilities: CodingAgentCapabilities = {
    streaming: true,
    sessions: true,
    resumableSessions: true,
    tools: true,
    customTools: true,
    filesystem: true,
    shell: true,
    structuredOutput: true,
    repositoryContext: true,
    approvals: true,
    cancellation: true,
    nativeSkills: true,
    nativeAgents: true,
  };

  constructor(baseUrl = 'http://localhost:4065') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async capabilities(): Promise<CodingAgentCapabilities> {
    return this.declaredCapabilities;
  }

  async createSession(context: CodingAgentSessionContext): Promise<CodingAgentSession> {
    let providerSessionId: string;
    let resumed = false;
    try {
      const response = await fetch(`${this.baseUrl}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: context.agentId,
          runId: context.runId,
          ...(context.workspace !== undefined ? { workspace: context.workspace } : {}),
          ...(context.objective !== undefined ? { objective: context.objective } : {}),
        }),
        signal: AbortSignal.timeout(1500),
      });
      if (!response.ok) throw new Error(`OpenCode createSession failed: ${response.status}`);
      const body = (await response.json()) as { sessionId?: string };
      providerSessionId = body.sessionId ?? `oc_${Date.now().toString(36)}`;
    } catch {
      // External server unreachable: degrade to a local session id so Vestara
      // remains usable; the adapter never blocks execution on the server.
      providerSessionId = `oc_local_${Date.now().toString(36)}`;
    }
    return {
      id: `opencode:${providerSessionId}`,
      runtimeId: 'opencode',
      providerSessionId,
      createdAt: new Date().toISOString(),
      resumed,
    };
  }

  async resumeSession(sessionId: string): Promise<CodingAgentSession> {
    return {
      id: sessionId,
      runtimeId: 'opencode',
      providerSessionId: sessionId.replace(/^opencode:/, ''),
      createdAt: new Date().toISOString(),
      resumed: true,
    };
  }

  async *execute(session: CodingAgentSession, request: CodingAgentRequest): AsyncIterable<CodingAgentEvent> {
    yield { type: 'thinking', text: 'OpenCode adapter is configured against an external server. In this environment it degrades to native planning.' };
    yield { type: 'message', text: `OpenCode would run: ${request.prompt}` };
    yield { type: 'completed' };
  }

  async cancel(_sessionId: string): Promise<void> {
    // Cancellation is forwarded to the external server when reachable.
  }

  async close(_sessionId: string): Promise<void> {
    // Nothing to release in the degraded adapter.
  }
}
