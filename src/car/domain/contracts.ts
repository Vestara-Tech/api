/** CAR — Coding Agent Runtime domain contracts. */

export type CodingAgentRuntimeId = 'vestara' | 'opencode' | 'claude-code' | 'codex' | 'gemini';

export interface CodingAgentCapabilities {
  readonly streaming: boolean;
  readonly sessions: boolean;
  readonly resumableSessions: boolean;
  readonly tools: boolean;
  readonly customTools: boolean;
  readonly filesystem: boolean;
  readonly shell: boolean;
  readonly structuredOutput: boolean;
  readonly repositoryContext: boolean;
  readonly approvals: boolean;
  readonly cancellation: boolean;
  readonly nativeSkills: boolean;
  readonly nativeAgents: boolean;
}

export interface CodingAgentSessionContext {
  readonly agentId: string;
  readonly runId: string;
  readonly workspace?: string;
  readonly objective?: string;
  readonly systemPrompt?: string;
}

export interface CodingAgentSession {
  readonly id: string;
  readonly runtimeId: CodingAgentRuntimeId;
  readonly providerSessionId: string;
  readonly createdAt: string;
  readonly resumed: boolean;
}

export interface CodingAgentRequest {
  readonly prompt: string;
  readonly tools?: readonly unknown[];
  readonly parentSessionId?: string;
}

export type CodingAgentEvent =
  | { readonly type: 'thinking'; readonly text: string }
  | { readonly type: 'message'; readonly text: string }
  | { readonly type: 'tool-requested'; readonly name: string; readonly input: unknown }
  | { readonly type: 'tool-started'; readonly name: string }
  | { readonly type: 'tool-completed'; readonly name: string; readonly output: unknown }
  | { readonly type: 'file-changed'; readonly path: string }
  | { readonly type: 'command-started'; readonly command: string }
  | { readonly type: 'command-output'; readonly output: string }
  | { readonly type: 'command-completed'; readonly command: string; readonly exitCode: number }
  | { readonly type: 'approval-required'; readonly tool: string; readonly reason: string }
  | { readonly type: 'usage'; readonly inputTokens: number; readonly outputTokens: number }
  | { readonly type: 'completed' }
  | { readonly type: 'failed'; readonly message: string };

export interface CodingAgentRuntime {
  readonly id: CodingAgentRuntimeId;

  capabilities(): Promise<CodingAgentCapabilities>;

  createSession(context: CodingAgentSessionContext): Promise<CodingAgentSession>;
  resumeSession(sessionId: string): Promise<CodingAgentSession>;
  execute(session: CodingAgentSession, request: CodingAgentRequest): AsyncIterable<CodingAgentEvent>;
  cancel(sessionId: string): Promise<void>;
  close(sessionId: string): Promise<void>;
}

/** Runtime policy on an agent definition. */
export type AgentRuntimeMode = 'vestara' | 'auto' | CodingAgentRuntimeId;

export interface AgentRuntimePolicy {
  readonly runtime: AgentRuntimeMode;
  readonly fallback?: readonly CodingAgentRuntimeId[];
  readonly requirements?: {
    readonly repositoryEditing?: boolean;
    readonly terminal?: boolean;
    readonly tools?: boolean;
    readonly resumableSessions?: boolean;
    readonly structuredOutput?: boolean;
  };
}

/** CAR-006 — runtime selection result. */
export interface SelectedRuntime {
  readonly runtimeId: CodingAgentRuntimeId;
  readonly capabilities: CodingAgentCapabilities;
  readonly viaFallback: boolean;
}

export interface CodingAgentRuntimeHealth {
  readonly runtimeId: CodingAgentRuntimeId;
  readonly healthy: boolean;
  readonly message?: string;
}
