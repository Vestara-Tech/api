import type { AiModel } from '../domain/contracts.js';
import type {
  AiEmbeddingAdapterInput,
  AiEmbeddingAdapterResult,
  AiExecutionContext,
  AiProviderAdapter,
  AiProviderResult,
  AiProviderStreamEvent,
  NormalizedAiRequest,
} from './provider-adapter.js';

/**
 * OpenAI-compatible provider adapter (AI-002). Talks to any endpoint that
 * implements the OpenAI Chat Completions HTTP contract. No provider SDK is
 * imported — the core runtime never depends on vendor packages.
 */
export class OpenAiCompatibleAdapter implements AiProviderAdapter {
  readonly providerId: string;
  private readonly apiEndpoint: string;
  private readonly apiKey: string;

  constructor(providerId: string, apiEndpoint: string, apiKey: string) {
    this.providerId = providerId;
    this.apiEndpoint = apiEndpoint.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  supports(model: AiModel): boolean {
    return model.providerId === this.providerId;
  }

  async embed(context: AiExecutionContext, request: AiEmbeddingAdapterInput): Promise<AiEmbeddingAdapterResult> {
    const response = await fetch(`${this.apiEndpoint}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'X-Vestara-Request-Id': context.requestId,
      },
      body: JSON.stringify({ model: request.modelId, input: request.input }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`AI provider ${this.providerId} embed error ${response.status}: ${text.slice(0, 300)}`);
    }

    const json = (await response.json()) as {
      data?: readonly { embedding?: readonly number[] }[];
      usage?: { prompt_tokens?: number; total_tokens?: number };
    };

    return {
      embeddings: (json.data ?? []).map((d) => d.embedding ?? []),
      usage: {
        inputTokens: json.usage?.prompt_tokens ?? json.usage?.total_tokens ?? 0,
        outputTokens: 0,
      },
    };
  }

  async generate(context: AiExecutionContext, request: NormalizedAiRequest): Promise<AiProviderResult> {
    const body: Record<string, unknown> = {
      model: request.modelId,
      messages: request.messages,
      stream: false,
    };
    if (request.system !== undefined) body.system = request.system;
    if (request.tools !== undefined && request.tools.length > 0) {
      body.tools = request.tools;
      body.tool_choice = 'auto';
    }
    if (request.outputSchema !== undefined) {
      body.response_format = { type: 'json_schema', json_schema: { name: 'result', schema: request.outputSchema } };
    }
    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.maxTokens !== undefined) body.max_tokens = request.maxTokens;

    const response = await fetch(`${this.apiEndpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'X-Vestara-Request-Id': context.requestId,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`AI provider ${this.providerId} error ${response.status}: ${text.slice(0, 300)}`);
    }

    const json = (await response.json()) as {
      choices?: readonly { message?: { content?: string | null; tool_calls?: readonly { id?: string; function?: { name?: string; arguments?: string } }[] } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };
    };

    const choice = json.choices?.[0];
    const toolCalls = (choice?.message?.tool_calls ?? []).map((tc) => ({
      id: tc.id ?? `tool_${Math.random().toString(36).slice(2, 8)}`,
      name: tc.function?.name ?? 'unknown',
      arguments: tc.function?.arguments ?? '{}',
    }));

    return {
      content: choice?.message?.content ?? '',
      usage: {
        inputTokens: json.usage?.prompt_tokens ?? 0,
        outputTokens: json.usage?.completion_tokens ?? 0,
        ...(json.usage?.prompt_tokens_details?.cached_tokens
          ? { cachedTokens: json.usage.prompt_tokens_details.cached_tokens }
          : {}),
      },
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
    };
  }

  async *stream(context: AiExecutionContext, request: NormalizedAiRequest): AsyncIterable<AiProviderStreamEvent> {
    const body: Record<string, unknown> = {
      model: request.modelId,
      messages: request.messages,
      stream: true,
    };
    if (request.system !== undefined) body.system = request.system;
    if (request.tools !== undefined && request.tools.length > 0) {
      body.tools = request.tools;
      body.tool_choice = 'auto';
    }
    if (request.temperature !== undefined) body.temperature = request.temperature;

    const response = await fetch(`${this.apiEndpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'X-Vestara-Request-Id': context.requestId,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => '');
      throw new Error(`AI provider ${this.providerId} stream error ${response.status}: ${text.slice(0, 300)}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let usage = { inputTokens: 0, outputTokens: 0 };

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') continue;
          let chunk: {
            choices?: readonly { delta?: { content?: string | null; tool_calls?: readonly { id?: string; function?: { name?: string; arguments?: string } }[] } }[];
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          };
          try {
            chunk = JSON.parse(payload) as typeof chunk;
          } catch {
            continue;
          }
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) yield { type: 'chunk', text: delta.content };
          for (const tc of delta?.tool_calls ?? []) {
            if (tc.function) {
              yield {
                type: 'tool-call',
                toolCall: {
                  id: tc.id ?? `tool_${Math.random().toString(36).slice(2, 8)}`,
                  name: tc.function.name ?? 'unknown',
                  arguments: tc.function.arguments ?? '{}',
                },
              };
            }
          }
          if (chunk.usage) {
            usage = {
              inputTokens: chunk.usage.prompt_tokens ?? 0,
              outputTokens: chunk.usage.completion_tokens ?? 0,
            };
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: 'done', usage };
  }
}
