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
 * Local Vestara adapter used as the repository-default fallback.
 *
 * It keeps the developer/planner/reviewer/verifier flows usable when no
 * external provider is enabled yet. It is deterministic and does not reach
 * out to a network provider.
 */
export class VestaraLocalAdapter implements AiProviderAdapter {
  readonly providerId = 'vestara';

  supports(model: AiModel): boolean {
    return model.providerId === this.providerId;
  }

  async generate(context: AiExecutionContext, request: NormalizedAiRequest): Promise<AiProviderResult> {
    const summary = summarizeRequest(request);
    const content = [
      `Vestara local model "${request.modelId}"`,
      `request=${context.requestId}`,
      summary !== '' ? `summary=${summary}` : undefined,
    ]
      .filter((line): line is string => line !== undefined)
      .join(' · ');

    return {
      content,
      usage: { inputTokens: 32, outputTokens: 64 },
    };
  }

  async *stream(context: AiExecutionContext, request: NormalizedAiRequest): AsyncIterable<AiProviderStreamEvent> {
    const result = await this.generate(context, request);
    yield { type: 'chunk', text: result.content };
    yield { type: 'done', usage: result.usage };
  }

  async embed(context: AiExecutionContext, request: AiEmbeddingAdapterInput): Promise<AiEmbeddingAdapterResult> {
    return {
      embeddings: request.input.map((value) => [value.length, context.requestId.length]),
      usage: { inputTokens: request.input.length, outputTokens: 0 },
    };
  }
}

function summarizeRequest(request: NormalizedAiRequest): string {
  const message = [...request.messages].at(-1);
  if (message === undefined || message === null) return '';
  if (typeof message !== 'object') return String(message);
  const content = (message as { content?: unknown }).content;
  if (typeof content === 'string') return content.slice(0, 120);
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part !== null && typeof part === 'object' && 'value' in part && typeof (part as { value?: unknown }).value === 'string') {
          return (part as { value: string }).value;
        }
        return '';
      })
      .filter(Boolean)
      .join(' ')
      .slice(0, 120);
  }
  return '';
}
