import type { ExecutionContextAssemblerDeps } from '../../agent/context/execution-context-assembler.js';
import type { AgentExecutionContext } from '../../agent/context/execution-context.js';
import type { CodingAgentEvent, CodingAgentRuntime, CodingAgentSession } from '../domain/contracts.js';

/**
 * DEX-CP3 — Execute through a CAR adapter with pre-assembled context.
 *
 * This is a pure function (no class state) that:
 *   1. Creates a session via the adapter
 *   2. Serializes the context into the session/system prompt
 *   3. Executes the prompt
 *   4. Collects events
 *
 * Use this when you already have an AgentExecutionContext (e.g., from tests
 * or from the assembler) and just need to execute through a specific adapter.
 */
export async function executeWithAdapter(
  adapter: CodingAgentRuntime,
  context: AgentExecutionContext,
  prompt: string,
  options?: {
    readonly tools?: readonly unknown[];
    readonly parentSessionId?: string;
  },
): Promise<DeveloperAdapterResult> {
  // 1. Create session.
  const session = await adapter.createSession({
    agentId: context.identity.agentId,
    runId: context.identity.runId,
    ...(context.repository?.root !== undefined ? { workspace: context.repository.root } : {}),
    objective: context.objective.goal ?? context.objective.task ?? '',
    systemPrompt: context.governance.systemInstructions,
  });

  // 2. Execute and collect events.
  const events: CodingAgentEvent[] = [];
  for await (const event of adapter.execute(session, {
    prompt,
    ...(options?.tools !== undefined ? { tools: options.tools } : {}),
    ...(options?.parentSessionId !== undefined ? { parentSessionId: options.parentSessionId } : {}),
  })) {
    events.push(event);
  }

  return { session, context, events, runtimeId: adapter.id };
}

/** Result of executing through an adapter with pre-assembled context. */
export interface DeveloperAdapterResult {
  readonly session: CodingAgentSession;
  readonly context: AgentExecutionContext;
  readonly events: readonly CodingAgentEvent[];
  readonly runtimeId: string;
}
