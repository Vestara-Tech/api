import type { ExecutionContextInput, ExecutionContextAssemblerDeps } from '../../agent/context/execution-context-assembler.js';
import type { AgentExecutionContext } from '../../agent/context/execution-context.js';
import type { RuntimeSelector } from './runtime-selector.js';
import type { ToolGateway } from './tool-gateway.js';
import type {
  CodingAgentEvent,
  CodingAgentRequest,
  CodingAgentRuntime,
  CodingAgentSession,
  AgentRuntimePolicy,
} from '../domain/contracts.js';

/** DEX-CP3 — Input for developer agent execution. */
export interface DeveloperRuntimeInput {
  readonly contextInput: ExecutionContextInput;
  readonly runtimePolicy: AgentRuntimePolicy;
  readonly prompt: string;
  readonly tools?: readonly unknown[];
  readonly parentSessionId?: string;
}

/** DEX-CP3 — Result of a developer agent execution. */
export interface DeveloperRuntimeResult {
  readonly session: CodingAgentSession;
  readonly context: AgentExecutionContext;
  readonly runtimeId: string;
  readonly events: readonly CodingAgentEvent[];
  readonly promptUsed: string;
}

/** DEX-CP3 — Dependencies for the DeveloperRuntime. */
export interface DeveloperRuntimeDeps {
  readonly assemblerDeps: ExecutionContextAssemblerDeps;
  readonly selector: RuntimeSelector;
  readonly gateway: ToolGateway;
}

/**
 * DEX-CP3 — Developer runtime. Bridges the canonical execution context
 * (CP2) with CAR adapters (OpenCode, Codex, etc.).
 *
 * Lifecycle:
 *   1. Assemble canonical AgentExecutionContext (CP2)
 *   2. Select CAR adapter via RuntimeSelector
 *   3. Create session via adapter
 *   4. Serialize context for the target runtime
 *   5. Execute prompt through the adapter
 *   6. Collect events and return result
 *
 * This is the single entry point for developer agent execution.
 * It does NOT format for any specific runtime — that is the adapter's job.
 */
export class DeveloperRuntime {
  private readonly assemblerDeps: ExecutionContextAssemblerDeps;
  private readonly selector: RuntimeSelector;
  private readonly gateway: ToolGateway;

  constructor(deps: DeveloperRuntimeDeps) {
    this.assemblerDeps = deps.assemblerDeps;
    this.selector = deps.selector;
    this.gateway = deps.gateway;
  }

  /**
   * Execute a developer agent task through the appropriate CAR adapter.
   *
   * The execution flow:
   *   contextInput → assemble → selectRuntime → createSession → execute → collectEvents
   */
  async execute(input: DeveloperRuntimeInput): Promise<DeveloperRuntimeResult> {
    // 1. Assemble canonical context.
    const { ExecutionContextAssembler } = await import('../../agent/context/execution-context-assembler.js');
    const assembler = new ExecutionContextAssembler(this.assemblerDeps);
    const context = await assembler.assemble(input.contextInput);

    // 2. Select runtime.
    const selected = await this.selector.select(input.runtimePolicy);

    // 3. Create session.
    const adapter = this.selector as unknown as { getRuntime(id: string): CodingAgentRuntime };
    // The registry provides the adapter — we need to access it through the selector's internal state.
    // Since RuntimeSelector doesn't expose the adapter directly, we'll use the session context approach.
    const sessionContext = {
      agentId: context.identity.agentId,
      runId: context.identity.runId,
      workspace: context.repository?.root,
      objective: context.objective.goal ?? context.objective.task ?? '',
      systemPrompt: context.governance.systemInstructions,
    };

    // We need to create a CodingAgentRuntime instance. The selector selected the runtime,
    // but doesn't expose it. We'll need to accept the adapter directly for now.
    // This is a transitional approach until CP3 fully wires the registry.
    throw new Error('DeveloperRuntime.execute requires adapter injection — use executeWithAdapter instead');
  }

  /**
   * Execute with an explicitly provided adapter.
   * This is the primary execution path for CP3.
   */
  async executeWithAdapter(
    input: DeveloperRuntimeInput,
    adapter: CodingAgentRuntime,
  ): Promise<DeveloperRuntimeResult> {
    // 1. Assemble canonical context.
    const { ExecutionContextAssembler } = await import('../../agent/context/execution-context-assembler.js');
    const assembler = new ExecutionContextAssembler(this.assemblerDeps);
    const context = await assembler.assemble(input.contextInput);

    // 2. Create session via adapter.
    const session = await adapter.createSession({
      agentId: context.identity.agentId,
      runId: context.identity.runId,
      ...(context.repository?.root !== undefined ? { workspace: context.repository.root } : {}),
      objective: context.objective.goal ?? context.objective.task ?? '',
      systemPrompt: context.governance.systemInstructions,
    });

    // 3. Collect execution events.
    const events: CodingAgentEvent[] = [];
    const request: CodingAgentRequest = {
      prompt: input.prompt,
      ...(input.tools !== undefined ? { tools: input.tools } : {}),
      ...(input.parentSessionId !== undefined ? { parentSessionId: input.parentSessionId } : {}),
    };

    for await (const event of adapter.execute(session, request)) {
      events.push(event);
    }

    return {
      session,
      context,
      runtimeId: adapter.id,
      events,
      promptUsed: input.prompt,
    };
  }

  /**
   * Cancel an active session.
   */
  async cancel(adapter: CodingAgentRuntime, sessionId: string): Promise<void> {
    await adapter.cancel(sessionId);
  }

  /**
   * Close a session and release resources.
   */
  async close(adapter: CodingAgentRuntime, sessionId: string): Promise<void> {
    await adapter.close(sessionId);
  }
}
