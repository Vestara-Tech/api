import { randomUUID } from 'node:crypto';

import { Codex, type Thread, type ThreadItem } from '@openai/codex-sdk';

import type {
  CodingAgentCapabilities,
  CodingAgentEvent,
  CodingAgentRequest,
  CodingAgentRuntime,
  CodingAgentRuntimeId,
  CodingAgentSession,
  CodingAgentSessionContext,
} from '../domain/contracts.js';

interface CodexSessionState {
  readonly thread: Thread;
  readonly context: CodingAgentSessionContext;
  actualThreadId?: string;
}

/**
 * Codex runtime adapter backed by the official Codex SDK. The SDK threads are
 * persisted by the Codex CLI; we keep a lightweight in-memory map for the
 * current process and alias the generated session key to the Codex thread ID
 * once the first turn starts.
 */
export class CodexAdapter implements CodingAgentRuntime {
  readonly id: CodingAgentRuntimeId = 'codex';
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
  private codexPromise?: Promise<Codex>;
  private readonly sessions = new Map<string, CodexSessionState>();
  private readonly threadAliases = new Map<string, string>();
  private readonly activeControllers = new Map<string, AbortController>();

  async capabilities(): Promise<CodingAgentCapabilities> {
    return this.declaredCapabilities;
  }

  async createSession(context: CodingAgentSessionContext): Promise<CodingAgentSession> {
    const codex = await this.getCodex();
    const providerSessionId = `thread_${randomUUID()}`;
    const thread = codex.startThread({
      workingDirectory: context.workspace ?? process.cwd(),
      skipGitRepoCheck: true,
    });
    this.sessions.set(providerSessionId, { thread, context });
    return {
      id: `codex:${providerSessionId}`,
      runtimeId: 'codex',
      providerSessionId,
      createdAt: new Date().toISOString(),
      resumed: false,
    };
  }

  async resumeSession(sessionId: string): Promise<CodingAgentSession> {
    const providerSessionId = normalizeSessionId(sessionId);
    const state = await this.ensureSessionState(providerSessionId);
    if (state) {
      return {
        id: `codex:${providerSessionId}`,
        runtimeId: 'codex',
        providerSessionId,
        createdAt: new Date().toISOString(),
        resumed: true,
      };
    }

    return {
      id: `codex:${providerSessionId}`,
      runtimeId: 'codex',
      providerSessionId,
      createdAt: new Date().toISOString(),
      resumed: true,
    };
  }

  async *execute(session: CodingAgentSession, request: CodingAgentRequest): AsyncIterable<CodingAgentEvent> {
    const providerSessionId = normalizeSessionId(session.providerSessionId);
    const state = await this.ensureSessionState(providerSessionId);
    if (!state) {
      yield {
        type: 'failed',
        message: `Codex thread "${providerSessionId}" could not be resumed`,
      };
      return;
    }

    const controller = new AbortController();
    this.activeControllers.set(providerSessionId, controller);

    try {
      const turn = await state.thread.run(buildPrompt(state.context, request), { signal: controller.signal });
      const actualThreadId = state.thread.id ?? providerSessionId;
      if (actualThreadId && actualThreadId !== providerSessionId) {
        state.actualThreadId = actualThreadId;
        this.threadAliases.set(actualThreadId, providerSessionId);
      }

      let emittedMessage = false;
      for (const item of turn.items) {
        for (const event of mapThreadItem(item)) {
          if (event.type === 'message') emittedMessage = true;
          yield event;
        }
      }

      if (!emittedMessage && turn.finalResponse.trim()) {
        yield { type: 'message', text: turn.finalResponse };
      }
      if (turn.usage) {
        yield {
          type: 'usage',
          inputTokens: turn.usage.input_tokens + turn.usage.cached_input_tokens,
          outputTokens: turn.usage.output_tokens,
        };
      }
      yield { type: 'completed' };
    } catch (error) {
      yield { type: 'failed', message: describeCodexError(error) };
    } finally {
      this.activeControllers.delete(providerSessionId);
    }
  }

  async cancel(sessionId: string): Promise<void> {
    const providerSessionId = normalizeSessionId(sessionId);
    const sessionKey = this.resolveSessionKey(providerSessionId);
    this.activeControllers.get(providerSessionId)?.abort();
    if (sessionKey && sessionKey !== providerSessionId) {
      this.activeControllers.get(sessionKey)?.abort();
    }
  }

  async close(sessionId: string): Promise<void> {
    const providerSessionId = normalizeSessionId(sessionId);
    const sessionKey = this.resolveSessionKey(providerSessionId) ?? providerSessionId;
    this.activeControllers.get(providerSessionId)?.abort();
    this.activeControllers.get(sessionKey)?.abort();
    this.activeControllers.delete(providerSessionId);
    this.activeControllers.delete(sessionKey);
    this.sessions.delete(sessionKey);
    for (const [alias, key] of this.threadAliases.entries()) {
      if (key === providerSessionId || key === sessionKey || alias === providerSessionId || alias === sessionKey) {
        this.threadAliases.delete(alias);
      }
    }
  }

  private async getCodex(): Promise<Codex> {
    if (!this.codexPromise) {
      this.codexPromise = Promise.resolve(new Codex());
    }
    return this.codexPromise;
  }

  private async ensureSessionState(providerSessionId: string): Promise<CodexSessionState | undefined> {
    const direct = this.sessions.get(providerSessionId);
    if (direct) return direct;

    const alias = this.threadAliases.get(providerSessionId);
    if (alias) {
      const aliased = this.sessions.get(alias);
      if (aliased) return aliased;
    }

    try {
      const codex = await this.getCodex();
      const thread = codex.resumeThread(providerSessionId);
      const state: CodexSessionState = {
        thread,
        context: {
          agentId: 'codex',
          runId: providerSessionId,
        },
      };
      this.sessions.set(providerSessionId, state);
      return state;
    } catch {
      return undefined;
    }
  }

  private resolveSessionKey(providerSessionId: string): string | undefined {
    if (this.sessions.has(providerSessionId)) {
      return providerSessionId;
    }
    return this.threadAliases.get(providerSessionId);
  }
}

function buildPrompt(context: CodingAgentSessionContext, request: CodingAgentRequest): string {
  const sections: string[] = [];
  if (context.objective?.trim()) {
    sections.push(`Objective:\n${context.objective.trim()}`);
  }
  if (context.systemPrompt?.trim()) {
    sections.push(`System instructions:\n${context.systemPrompt.trim()}`);
  }
  if (request.parentSessionId) {
    sections.push(`Parent session: ${request.parentSessionId}`);
  }
  sections.push(request.prompt);
  return sections.join('\n\n');
}

function mapThreadItem(item: ThreadItem): CodingAgentEvent[] {
  switch (item.type) {
    case 'agent_message':
      return item.text.trim() ? [{ type: 'message', text: item.text }] : [];
    case 'reasoning':
      return item.text.trim() ? [{ type: 'thinking', text: item.text }] : [];
    case 'command_execution': {
      const events: CodingAgentEvent[] = [];
      if (item.status === 'in_progress') {
        events.push({ type: 'command-started', command: item.command });
      }
      if (item.aggregated_output.trim()) {
        events.push({ type: 'command-output', output: item.aggregated_output });
      }
      if (item.status === 'completed' || item.status === 'failed') {
        events.push({
          type: 'command-completed',
          command: item.command,
          exitCode: item.exit_code ?? (item.status === 'failed' ? 1 : 0),
        });
      }
      return events;
    }
    case 'file_change':
      return item.changes
        .map((change) => change.path.trim())
        .filter((path) => path.length > 0)
        .map((path) => ({ type: 'file-changed', path }));
    case 'mcp_tool_call': {
      const events: CodingAgentEvent[] = [];
      if (item.status === 'in_progress') {
        events.push({ type: 'tool-requested', name: item.tool, input: item.arguments });
        events.push({ type: 'tool-started', name: item.tool });
      }
      if (item.status === 'completed') {
        events.push({
          type: 'tool-completed',
          name: item.tool,
          output: item.result ?? null,
        });
      }
      if (item.status === 'failed') {
        events.push({
          type: 'tool-completed',
          name: item.tool,
          output: { error: item.error?.message ?? 'Codex tool call failed' },
        });
      }
      return events;
    }
    case 'web_search':
      return item.query.trim() ? [{ type: 'thinking', text: `Web search: ${item.query}` }] : [];
    case 'todo_list':
      return item.items.length > 0
        ? [
            {
              type: 'thinking',
              text: item.items.map((todo) => `${todo.completed ? '[x]' : '[ ]'} ${todo.text}`).join('\n'),
            },
          ]
        : [];
    case 'error':
      return item.message.trim() ? [{ type: 'thinking', text: `Codex note: ${item.message}` }] : [];
    default:
      return [];
  }
}

function normalizeSessionId(sessionId: string): string {
  return sessionId.replace(/^codex:/, '');
}

function describeCodexError(error: unknown): string {
  if (typeof error === 'string') return error;
  if (!error || typeof error !== 'object') return 'Codex request failed';
  const typed = error as { message?: unknown; name?: unknown; data?: { message?: unknown } };
  if (typeof typed.data?.message === 'string' && typed.data.message.trim()) return typed.data.message;
  if (typeof typed.message === 'string' && typed.message.trim()) return typed.message;
  if (typeof typed.name === 'string' && typed.name.trim()) return typed.name;
  return 'Codex request failed';
}
