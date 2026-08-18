import {
  createOpencode,
  createOpencodeClient,
  type AssistantMessage,
  type OpencodeClient,
  type Part,
  type Session as OpenCodeSession,
  type ServerOptions,
  type TextPartInput,
} from '@opencode-ai/sdk';

import type {
  CodingAgentCapabilities,
  CodingAgentEvent,
  CodingAgentRequest,
  CodingAgentRuntime,
  CodingAgentRuntimeId,
  CodingAgentSession,
  CodingAgentSessionContext,
} from '../domain/contracts.js';
import type { OpenCodeEnvironmentConfig } from '../domain/opencode-config.js';

export interface OpenCodeAdapterOptions extends Pick<ServerOptions, 'hostname' | 'port' | 'timeout' | 'config'> {
  readonly baseUrl?: string;
}

interface OpenCodeRuntimeHandle {
  readonly client: OpencodeClient;
  readonly server?: {
    close(): void;
  };
}

interface OpenCodeSessionState extends CodingAgentSessionContext {
  readonly directory?: string;
}

type RequestResult<T> =
  | {
      readonly data: T;
      readonly error?: unknown;
      readonly request: unknown;
      readonly response: unknown;
    }
  | T
  | undefined;

type RawSdkResult<T> = {
  readonly data?: T | undefined;
  readonly error?: unknown;
  readonly request?: unknown;
  readonly response?: unknown;
} | T;

/**
 * CAR-011 — OpenCode reference adapter backed by the official OpenCode SDK.
 * The adapter prefers an embedded OpenCode instance by default and can also
 * attach to a running server when a base URL is provided.
 */
export class OpenCodeAdapter implements CodingAgentRuntime {
  readonly id: CodingAgentRuntimeId = 'opencode';
  private readonly options: OpenCodeAdapterOptions;
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
  private runtimePromise?: Promise<OpenCodeRuntimeHandle>;
  private readonly sessions = new Map<string, OpenCodeSessionState>();
  private readonly activeControllers = new Map<string, AbortController>();

  constructor(options: string | OpenCodeAdapterOptions | OpenCodeEnvironmentConfig = {}) {
    if (typeof options === 'string') {
      this.options = { baseUrl: options };
    } else if ('mode' in options) {
      // DEX-CP0 — Map OpenCodeEnvironmentConfig to adapter options.
      const config = options;
      if (config.mode === 'external') {
        this.options = {
          ...(config.baseUrl !== undefined ? { baseUrl: config.baseUrl } : {}),
          timeout: config.startupTimeoutMs,
        };
      } else {
        this.options = {
          ...(config.hostname !== undefined ? { hostname: config.hostname } : {}),
          ...(config.port !== undefined ? { port: config.port } : {}),
          timeout: config.startupTimeoutMs,
        };
      }
    } else {
      this.options = options;
    }
  }

  async capabilities(): Promise<CodingAgentCapabilities> {
    return this.declaredCapabilities;
  }

  async createSession(context: CodingAgentSessionContext): Promise<CodingAgentSession> {
    const runtime = await this.getRuntime();
    const result = await runtime.client.session.create({
      ...(context.workspace ? { query: { directory: context.workspace } } : {}),
      body: {
        title: context.objective?.trim() || context.agentId,
      },
    });
    const createdSession = unwrapRequestResult<OpenCodeSession>(result, 'OpenCode session creation failed');
    this.sessions.set(createdSession.id, {
      ...context,
      directory: createdSession.directory,
    });
    return {
      id: `opencode:${createdSession.id}`,
      runtimeId: 'opencode',
      providerSessionId: createdSession.id,
      createdAt: new Date(createdSession.time.created).toISOString(),
      resumed: false,
    };
  }

  async resumeSession(sessionId: string): Promise<CodingAgentSession> {
    const providerSessionId = normalizeSessionId(sessionId);
    const runtime = await this.getRuntime();
    const cached = this.sessions.get(providerSessionId);

    try {
      const result = await runtime.client.session.get({
        path: { id: providerSessionId },
        ...(cached?.directory ? { query: { directory: cached.directory } } : {}),
      });
      const session = unwrapRequestResult<OpenCodeSession>(result, 'OpenCode session lookup failed');
      this.sessions.set(providerSessionId, {
        ...(cached ?? { agentId: 'opencode', runId: providerSessionId }),
        directory: session.directory,
      });
      return {
        id: `opencode:${session.id}`,
        runtimeId: 'opencode',
        providerSessionId: session.id,
        createdAt: new Date(session.time.created).toISOString(),
        resumed: true,
      };
    } catch {
      return {
        id: `opencode:${providerSessionId}`,
        runtimeId: 'opencode',
        providerSessionId,
        createdAt: new Date().toISOString(),
        resumed: true,
      };
    }
  }

  async *execute(session: CodingAgentSession, request: CodingAgentRequest): AsyncIterable<CodingAgentEvent> {
    const providerSessionId = normalizeSessionId(session.providerSessionId);
    const runtime = await this.getRuntime();
    const state = this.sessions.get(providerSessionId);
    const controller = new AbortController();
    this.activeControllers.set(providerSessionId, controller);

    try {
      const tools = request.tools ? normalizeToolMap(request.tools) : undefined;
      const result = await runtime.client.session.prompt({
        path: { id: providerSessionId },
        ...(state?.directory ? { query: { directory: state.directory } } : {}),
        signal: controller.signal,
        body: {
          agent: state?.agentId ?? 'opencode',
          ...(state?.systemPrompt ? { system: state.systemPrompt } : {}),
          ...(tools ? { tools } : {}),
          parts: buildPromptParts(state, request),
        },
      });
      const response = unwrapRequestResult<OpenCodePromptResponse>(result, 'OpenCode prompt failed');

      if (response.info.error) {
        yield { type: 'failed', message: describeOpenCodeError(response.info.error) };
        return;
      }

      let emittedMessage = false;
      for (const part of response.parts) {
        for (const event of mapOpenCodePart(part)) {
          if (event.type === 'message') emittedMessage = true;
          yield event;
        }
      }

      const fallbackText = extractOpenCodeText(response.parts);
      if (!emittedMessage && fallbackText) {
        yield { type: 'message', text: fallbackText };
      }

      yield* emitUsage(response.info);
      yield { type: 'completed' };
    } catch (error) {
      yield { type: 'failed', message: describeOpenCodeError(error) };
    } finally {
      this.activeControllers.delete(providerSessionId);
    }
  }

  async cancel(sessionId: string): Promise<void> {
    const providerSessionId = normalizeSessionId(sessionId);
    this.activeControllers.get(providerSessionId)?.abort();
    const runtime = await this.getRuntime();
    const directory = this.sessions.get(providerSessionId)?.directory;
    try {
      await runtime.client.session.abort({
        path: { id: providerSessionId },
        ...(directory ? { query: { directory } } : {}),
      });
    } catch {
      // Cancellation is best-effort.
    }
  }

  async close(sessionId: string): Promise<void> {
    const providerSessionId = normalizeSessionId(sessionId);
    const directory = this.sessions.get(providerSessionId)?.directory;
    this.activeControllers.get(providerSessionId)?.abort();
    this.activeControllers.delete(providerSessionId);
    this.sessions.delete(providerSessionId);

    try {
      const runtime = await this.getRuntime();
      await runtime.client.session.delete({
        path: { id: providerSessionId },
        ...(directory ? { query: { directory } } : {}),
      });
    } catch {
      // Closing is best-effort; we only need to forget local state.
    }
  }

  private async getRuntime(): Promise<OpenCodeRuntimeHandle> {
    if (!this.runtimePromise) {
      this.runtimePromise = this.createRuntime();
    }
    return this.runtimePromise;
  }

  private async createRuntime(): Promise<OpenCodeRuntimeHandle> {
    if (this.options.baseUrl) {
      return {
        client: createOpencodeClient({
          baseUrl: this.options.baseUrl,
        }),
      };
    }

    // DEX-CP0 — Validate external mode requirements at connection time.
    // If no baseUrl is set, we fall through to managed mode (start embedded server).
    // External mode callers must provide baseUrl; this is validated here rather than
    // at config load time so bootstrap can succeed without OpenCode configured.

    const { client, server } = await createOpencode({
      ...(this.options.hostname !== undefined ? { hostname: this.options.hostname } : {}),
      ...(this.options.port !== undefined ? { port: this.options.port } : {}),
      ...(this.options.timeout !== undefined ? { timeout: this.options.timeout } : {}),
      ...(this.options.config !== undefined ? { config: this.options.config } : {}),
    });
    return { client, server };
  }
}

interface OpenCodePromptResponse {
  readonly info: AssistantMessage;
  readonly parts: readonly Part[];
}

function buildPromptParts(state: OpenCodeSessionState | undefined, request: CodingAgentRequest): TextPartInput[] {
  const sections: string[] = [];
  if (state?.objective?.trim()) {
    sections.push(`Objective:\n${state.objective.trim()}`);
  }
  if (state?.systemPrompt?.trim()) {
    sections.push(`System instructions:\n${state.systemPrompt.trim()}`);
  }
  if (request.parentSessionId) {
    sections.push(`Parent session: ${request.parentSessionId}`);
  }
  if (sections.length > 0) {
    sections.push(request.prompt);
    return [{ type: 'text', text: sections.join('\n\n') }];
  }
  return [{ type: 'text', text: request.prompt }];
}

function emitUsage(info: AssistantMessage): CodingAgentEvent[] {
  const tokens = info.tokens;
  if (!tokens) return [];
  return [
    {
      type: 'usage',
      inputTokens: tokens.input + tokens.cache.read,
      outputTokens: tokens.output,
    },
  ];
}

function mapOpenCodePart(part: Part): CodingAgentEvent[] {
  switch (part.type) {
    case 'text':
      return part.text.trim() ? [{ type: 'message', text: part.text }] : [];
    case 'reasoning':
      return part.text.trim() ? [{ type: 'thinking', text: part.text }] : [];
    case 'file': {
      const path = part.filename ?? part.source?.path ?? part.url;
      return path ? [{ type: 'file-changed', path }] : [];
    }
    case 'patch':
      return part.files.map((path) => ({ type: 'file-changed', path }));
    case 'tool': {
      const input = part.state.input;
      if (part.state.status === 'pending' || part.state.status === 'running') {
        return [
          { type: 'tool-requested', name: part.tool, input },
          { type: 'tool-started', name: part.tool },
        ];
      }
      if (part.state.status === 'completed') {
        return [
          { type: 'tool-completed', name: part.tool, output: { title: part.state.title, output: part.state.output, metadata: part.state.metadata } },
        ];
      }
      return [
        {
          type: 'tool-completed',
          name: part.tool,
          output: { error: part.state.error, metadata: part.state.metadata },
        },
      ];
    }
    case 'step-start':
      return [{ type: 'thinking', text: 'OpenCode step started' }];
    case 'step-finish':
      return [
        {
          type: 'usage',
          inputTokens: part.tokens.input + part.tokens.cache.read,
          outputTokens: part.tokens.output,
        },
      ];
    case 'snapshot':
      return [];
    case 'agent':
      return part.name ? [{ type: 'thinking', text: `Agent: ${part.name}` }] : [];
    case 'retry':
      return [{ type: 'thinking', text: `Retry attempt ${part.attempt}` }];
    case 'compaction':
      return [{ type: 'thinking', text: part.auto ? 'OpenCode compacted context automatically' : 'OpenCode compacted context' }];
    case 'subtask':
      return [
        {
          type: 'message',
          text: part.prompt,
        },
      ];
    default:
      return [];
  }
}

function extractOpenCodeText(parts: readonly Part[]): string {
  return parts
    .flatMap((part) => (part.type === 'text' ? [part.text] : part.type === 'reasoning' ? [part.text] : []))
    .map((text) => text.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function normalizeToolMap(tools: readonly unknown[]): Record<string, boolean> | undefined {
  const enabledTools = new Map<string, boolean>();
  for (const tool of tools) {
    if (typeof tool === 'string' && tool.trim()) {
      enabledTools.set(tool.trim(), true);
      continue;
    }
    if (!tool || typeof tool !== 'object') continue;
    const candidate = (tool as { name?: unknown; tool?: unknown; id?: unknown }).name ?? (tool as { name?: unknown; tool?: unknown; id?: unknown }).tool ?? (tool as { name?: unknown; tool?: unknown; id?: unknown }).id;
    if (typeof candidate === 'string' && candidate.trim()) {
      enabledTools.set(candidate.trim(), true);
    }
  }
  return enabledTools.size > 0 ? Object.fromEntries(enabledTools) : undefined;
}

function normalizeSessionId(sessionId: string): string {
  return sessionId.replace(/^opencode:/, '');
}

function unwrapRequestResult<T>(result: RawSdkResult<T>, message: string): T {
  if (result && typeof result === 'object' && 'request' in result && 'response' in result) {
    if ('error' in result && result.error !== undefined) {
      throw new Error(describeOpenCodeError(result.error, message));
    }
    return result.data as T;
  }
  if (result === undefined) {
    throw new Error(message);
  }
  return result as T;
}

function describeOpenCodeError(error: unknown, fallback = 'OpenCode request failed'): string {
  if (typeof error === 'string') return error;
  if (!error || typeof error !== 'object') return fallback;
  const typed = error as { message?: unknown; name?: unknown; data?: { message?: unknown } };
  if (typeof typed.data?.message === 'string' && typed.data.message.trim()) return typed.data.message;
  if (typeof typed.message === 'string' && typed.message.trim()) return typed.message;
  if (typeof typed.name === 'string' && typed.name.trim()) return typed.name;
  return fallback;
}
