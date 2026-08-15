import type {
  AiModel,
  AiProvider,
  AiToolCall,
  AiUsage,
} from '../domain/contracts.js';

/** Normalized request a provider adapter executes. */
export interface NormalizedAiRequest {
  readonly providerId: string;
  readonly modelId: string;
  readonly messages: readonly unknown[];
  readonly system?: string;
  readonly tools?: readonly unknown[];
  readonly outputSchema?: unknown;
  readonly temperature?: number;
  readonly maxTokens?: number;
}

/** Provider-agnostic generation result. */
export interface AiProviderResult {
  readonly content: string;
  readonly usage: AiUsage;
  readonly toolCalls?: readonly AiToolCall[];
  readonly finishReason?: string;
}

export type AiProviderStreamEvent =
  | { readonly type: 'chunk'; readonly text: string }
  | { readonly type: 'tool-call'; readonly toolCall: AiToolCall }
  | { readonly type: 'done'; readonly usage: AiUsage }
  | { readonly type: 'error'; readonly message: string };

export interface AiExecutionContext {
  readonly requestId: string;
  readonly consumerId: string;
}

/**
 * AI-002 — Provider adapter port. Vestara modules depend on `AiRuntime`,
 * never on a concrete provider SDK. Provider SDKs never escape adapters.
 */
export interface AiProviderAdapter {
  readonly providerId: string;

  /** Whether this adapter can serve the given model (id/namespace match). */
  supports(model: AiModel): boolean;

  generate(
    context: AiExecutionContext,
    request: NormalizedAiRequest,
  ): Promise<AiProviderResult>;

  stream(
    context: AiExecutionContext,
    request: NormalizedAiRequest,
  ): AsyncIterable<AiProviderStreamEvent>;
}

/** Adapter registration input (provider metadata + optional capability probe). */
export interface AiProviderAdapterRegistration {
  readonly provider: AiProvider;
  readonly adapter: AiProviderAdapter;
}
