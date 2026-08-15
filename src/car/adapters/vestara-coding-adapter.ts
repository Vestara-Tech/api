import type { AgentRuntime } from '../../agent/runtime/agent-runtime.js';
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
 * Native Vestara runtime as a CodingAgentRuntime. The AgentRuntime is the
 * reference execution engine; external coding runtimes are normalized to the
 * same contract.
 */
export class VestaraCodingAdapter implements CodingAgentRuntime {
  readonly id: CodingAgentRuntimeId = 'vestara';
  private readonly agents: AgentRuntime;

  constructor(agents: AgentRuntime) {
    this.agents = agents;
  }

  async capabilities(): Promise<CodingAgentCapabilities> {
    return {
      streaming: true,
      sessions: true,
      resumableSessions: true,
      tools: true,
      customTools: true,
      filesystem: false,
      shell: false,
      structuredOutput: true,
      repositoryContext: true,
      approvals: true,
      cancellation: true,
      nativeSkills: true,
      nativeAgents: true,
    };
  }

  async createSession(context: CodingAgentSessionContext): Promise<CodingAgentSession> {
    const run = this.agents.start({ agentId: context.agentId, goal: context.objective ?? '' });
    return {
      id: `vestara:${run.id}`,
      runtimeId: 'vestara',
      providerSessionId: run.id,
      createdAt: new Date().toISOString(),
      resumed: false,
    };
  }

  async resumeSession(sessionId: string): Promise<CodingAgentSession> {
    return { id: sessionId, runtimeId: 'vestara', providerSessionId: sessionId.replace(/^vestara:/, ''), createdAt: new Date().toISOString(), resumed: true };
  }

  async *execute(session: CodingAgentSession, request: CodingAgentRequest): AsyncIterable<CodingAgentEvent> {
    yield { type: 'message', text: request.prompt };
    const run = this.agents.state.get(session.providerSessionId);
    if (run) {
      yield { type: 'message', text: `Agent run ${run.id} is ${run.status}` };
      yield { type: 'usage', inputTokens: 0, outputTokens: 0 };
      yield { type: 'completed' };
      return;
    }
    yield { type: 'failed', message: `Run ${session.providerSessionId} not found` };
  }

  async cancel(sessionId: string): Promise<void> {
    this.agents.cancel(sessionId.replace(/^vestara:/, ''));
  }

  async close(_sessionId: string): Promise<void> {
    // Nothing to release.
  }
}
