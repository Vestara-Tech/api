/**
 * ARX stabilization — OpenCode AI provider adapter bridge.
 *
 * Registers the configured OpenCode default model as a first-class AI
 * provider so the AI model router (used by the Agent run path) can resolve
 * the same OpenCode model that DEX-E2E-001 proved through the CAR runtime.
 *
 * The adapter speaks the OpenCode server protocol via the official SDK —
 * the identical runtime the CAR OpenCodeAdapter uses. Generation is
 * session-based: a single-turn prompt against a fresh OpenCode session.
 */

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
import type { AiModel } from '../domain/contracts.js';
import type {
  AiExecutionContext,
  AiProviderAdapter,
  AiProviderResult,
  AiProviderStreamEvent,
  NormalizedAiRequest,
} from './provider-adapter.js';
import type { OpenCodeEnvironmentConfig } from '../../car/domain/opencode-config.js';

type RawSdkResult<T> =
  | {
      readonly data?: T | undefined;
      readonly error?: unknown;
      readonly request?: unknown;
      readonly response?: unknown;
    }
  | T;

interface OpenCodeRuntimeHandle {
  readonly client: OpencodeClient;
  readonly server?: {
    close(): void;
  };
}

interface OpenCodePromptResponse {
  readonly info: AssistantMessage;
  readonly parts: readonly Part[];
}

/**
 * Adapter that serves the `opencode` AI provider. Requires the OpenCode
 * server URL (external mode) or will start an embedded server (managed mode).
 */
export class OpenCodeAiProviderAdapter implements AiProviderAdapter {
  readonly providerId: string;
  private readonly config: OpenCodeEnvironmentConfig;
  private runtimePromise?: Promise<OpenCodeRuntimeHandle>;

  constructor(providerId: string, config: OpenCodeEnvironmentConfig) {
    this.providerId = providerId;
    this.config = config;
  }

  supports(model: AiModel): boolean {
    return model.providerId === this.providerId;
  }

  async generate(context: AiExecutionContext, request: NormalizedAiRequest): Promise<AiProviderResult> {
    const runtime = await this.getRuntime();
    const created = await runtime.client.session.create({
      body: { title: request.modelId },
    });
    const session = unwrapSdkResult<OpenCodeSession>(created, 'OpenCode session creation failed');
    const providerSessionId = session.id;

    try {
      const prompt = await runtime.client.session.prompt({
        path: { id: providerSessionId },
        body: {
          parts: buildPromptParts(request),
          ...(request.tools !== undefined && request.tools.length > 0 ? { tools: normalizeToolNames(request.tools) } : {}),
          ...(request.system !== undefined ? { system: request.system } : {}),
        },
      });
      const response = unwrapSdkResult<OpenCodePromptResponse>(prompt, 'OpenCode prompt failed');

      if (response.info.error) {
        throw new Error(describeOpenCodeError(response.info.error));
      }

      const content = extractText(response.parts);
      const tokens = response.info.tokens;
      return {
        content,
        usage: {
          inputTokens: tokens ? tokens.input + tokens.cache.read : 0,
          outputTokens: tokens ? tokens.output : 0,
        },
      };
    } finally {
      await runtime.client.session.delete({ path: { id: providerSessionId } }).catch(() => undefined);
    }
  }

  async *stream(context: AiExecutionContext, request: NormalizedAiRequest): AsyncIterable<AiProviderStreamEvent> {
    const result = await this.generate(context, request);
    if (result.content) yield { type: 'chunk', text: result.content };
    yield { type: 'done', usage: result.usage };
  }

  private async getRuntime(): Promise<OpenCodeRuntimeHandle> {
    if (!this.runtimePromise) {
      this.runtimePromise = this.createRuntime();
    }
    return this.runtimePromise;
  }

  private async createRuntime(): Promise<OpenCodeRuntimeHandle> {
    if (this.config.mode === 'external') {
      if (this.config.baseUrl === undefined) {
        throw new Error('OpenCode external mode requires a base URL');
      }
      return {
        client: createOpencodeClient({ baseUrl: this.config.baseUrl }),
      };
    }

    const options: ServerOptions = {};
    if (this.config.hostname !== undefined) options.hostname = this.config.hostname;
    if (this.config.port !== undefined) options.port = this.config.port;
    if (this.config.startupTimeoutMs !== undefined) options.timeout = this.config.startupTimeoutMs;
    const { client, server } = await createOpencode(options);
    return { client, server };
  }
}

function buildPromptParts(request: NormalizedAiRequest): TextPartInput[] {
  const sections: string[] = [];
  if (request.system?.trim()) sections.push(`System instructions:\n${request.system.trim()}`);
  const transcript = request.messages
    .map((message) => {
      const role = typeof message === 'object' && message !== null && 'role' in message ? String((message as { role: unknown }).role) : 'user';
      const content = typeof message === 'object' && message !== null && 'content' in message ? (message as { content: unknown }).content : message;
      const text = typeof content === 'string' ? content : typeof content === 'object' && content !== null ? JSON.stringify(content) : String(content ?? '');
      return `${role}: ${text}`;
    })
    .join('\n');
  sections.push(transcript);
  return [{ type: 'text', text: sections.join('\n\n') }];
}

function normalizeToolNames(tools: readonly unknown[]): Record<string, boolean> {
  const enabled: Record<string, boolean> = {};
  for (const tool of tools) {
    if (typeof tool === 'string' && tool.trim()) {
      enabled[tool.trim()] = true;
      continue;
    }
    if (!tool || typeof tool !== 'object') continue;
    const candidate = (tool as { name?: unknown }).name ?? (tool as { tool?: unknown }).tool;
    if (typeof candidate === 'string' && candidate.trim()) enabled[candidate.trim()] = true;
  }
  return enabled;
}

function extractText(parts: readonly Part[]): string {
  return parts
    .flatMap((part) => (part.type === 'text' ? [part.text] : part.type === 'reasoning' ? [part.text] : []))
    .map((text) => text.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function unwrapSdkResult<T>(result: RawSdkResult<T>, message: string): T {
  if (result && typeof result === 'object' && 'request' in result && 'response' in result) {
    if ('error' in result && result.error !== undefined) {
      throw new Error(describeOpenCodeError(result.error, message));
    }
    return result.data as T;
  }
  if (result === undefined) throw new Error(message);
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