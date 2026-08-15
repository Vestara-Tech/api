import type {
  CodingAgentCapabilities,
  CodingAgentEvent,
  CodingAgentRequest,
  CodingAgentRuntime,
  CodingAgentRuntimeId,
  CodingAgentSession,
  CodingAgentSessionContext,
} from '../domain/contracts.js';

export interface MemoryRuntimeOptions {
  readonly capabilities?: Partial<CodingAgentCapabilities>;
  readonly toolRequests?: readonly { name: string; input: unknown }[];
}

/** CAR — in-memory test/development adapter with a configurable capability set. */
export class MemoryCodingAdapter implements CodingAgentRuntime {
  readonly id: CodingAgentRuntimeId;
  private readonly toolRequests: readonly { name: string; input: unknown }[];
  private readonly caps: CodingAgentCapabilities;

  constructor(id: CodingAgentRuntimeId, options: MemoryRuntimeOptions = {}) {
    this.id = id;
    this.toolRequests = options.toolRequests ?? [];
    this.caps = {
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
      ...options.capabilities,
    };
  }

  async capabilities(): Promise<CodingAgentCapabilities> {
    return this.caps;
  }

  async createSession(context: CodingAgentSessionContext): Promise<CodingAgentSession> {
    return { id: `${this.id}:${context.runId}`, runtimeId: this.id, providerSessionId: context.runId, createdAt: new Date().toISOString(), resumed: false };
  }

  async resumeSession(sessionId: string): Promise<CodingAgentSession> {
    return { id: sessionId, runtimeId: this.id, providerSessionId: sessionId, createdAt: new Date().toISOString(), resumed: true };
  }

  async *execute(session: CodingAgentSession, request: CodingAgentRequest): AsyncIterable<CodingAgentEvent> {
    for (const tool of this.toolRequests) {
      yield { type: 'tool-requested', name: tool.name, input: tool.input };
      yield { type: 'tool-started', name: tool.name };
      yield { type: 'tool-completed', name: tool.name, output: { ok: true } };
    }
    yield { type: 'message', text: `[${this.id}] ${request.prompt}` };
    yield { type: 'usage', inputTokens: 10, outputTokens: 4 };
    yield { type: 'completed' };
  }

  async cancel(_sessionId: string): Promise<void> {}

  async close(_sessionId: string): Promise<void> {}
}
