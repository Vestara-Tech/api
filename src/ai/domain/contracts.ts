/** AI-001 — AI domain contracts. */

/** Provider kinds supported by Vestara adapters. */
export type AiProviderType = 'native' | 'openai-compatible' | 'local' | 'gateway';

export interface AiProvider {
  readonly id: string;
  readonly name: string;
  readonly type: AiProviderType;
  readonly enabled: boolean;
  readonly priority: number;
  readonly description?: string;
  readonly apiEndpoint?: string;
  readonly defaultModelId?: string;
  readonly apiKeyEnvVar?: string;
  /** Inline API key or OpenCode-style secret reference such as `{env:OPENAI_API_KEY}`. */
  readonly apiKey?: string;
}

/** Modalities a model can accept or produce. */
export type AiModality = 'text' | 'image' | 'audio' | 'video' | 'document';

export interface AiModelCapabilities {
  readonly reasoning: boolean;
  readonly tools: boolean;
  readonly structuredOutput: boolean;
  readonly functionCalling: boolean;
  readonly vision: boolean;
  readonly embeddings: boolean;
  readonly streaming: boolean;
}

export interface AiModelPricing {
  readonly inputPerMillion?: number;
  readonly outputPerMillion?: number;
  readonly cacheReadPerMillion?: number;
  readonly cacheWritePerMillion?: number;
}

export interface AiModel {
  readonly id: string;
  readonly providerId: string;
  readonly name: string;
  readonly description?: string;
  readonly capabilities: AiModelCapabilities;
  readonly modalities: readonly AiModality[];
  readonly contextWindow: number;
  readonly maxOutputTokens?: number;
  readonly pricing?: AiModelPricing;
  readonly openWeight: boolean;
  readonly lifecycleStatus: 'ga' | 'beta' | 'deprecated' | 'preview';
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Optimization profiles for model routing. */
export type AiOptimizationProfile =
  | 'quality'
  | 'balanced'
  | 'cost'
  | 'latency'
  | 'local'
  | 'offline'
  | 'auto';

/** Capability-driven model selector (routing by requirements, not hardcoded id). */
export interface AiModelRequirements {
  readonly reasoning?: boolean;
  readonly tools?: boolean;
  readonly structuredOutput?: boolean;
  readonly functionCalling?: boolean;
  readonly vision?: boolean;
  readonly embeddings?: boolean;
  readonly input?: readonly AiModality[];
  readonly minContext?: number;
}

export type AiModelSelector =
  | { readonly provider: string; readonly model: string }
  | { readonly requirements: AiModelRequirements; readonly optimizeFor?: AiOptimizationProfile };

/** Consumer identity for governance, usage and budgeting. */
export interface AiConsumer {
  readonly type: 'module' | 'agent' | 'workflow' | 'service' | 'user';
  readonly id: string;
}

export type AiRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AiContentPart {
  readonly type: 'text' | 'image' | 'audio' | 'document';
  readonly value: string;
  readonly mediaType?: string;
}

export interface AiMessage {
  readonly role: AiRole;
  readonly content: string | readonly AiContentPart[];
  readonly name?: string;
  readonly toolCalls?: readonly AiToolCall[];
  readonly toolCallId?: string;
}

export interface AiToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: string;
}

export interface AiToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: unknown;
}

export interface AiGenerateRequest {
  readonly consumer: AiConsumer;
  readonly model: AiModelSelector;
  readonly messages: readonly AiMessage[];
  readonly system?: string;
  readonly tools?: readonly AiToolDefinition[];
  readonly output?: { readonly schema: unknown };
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly fallbackCount?: number;
}

export interface AiGenerateResult {
  readonly content: string;
  readonly modelId: string;
  readonly providerId: string;
  readonly usage: AiUsage;
  readonly latencyMs: number;
  readonly fallbackCount: number;
  /** AI-010 — tool calls the model requested (if tools were provided). */
  readonly toolCalls?: readonly AiToolCall[];
}

export type AiStreamEvent =
  | { readonly type: 'chunk'; readonly text: string }
  | { readonly type: 'tool-call'; readonly toolCall: AiToolCall }
  | { readonly type: 'done'; readonly modelId: string; readonly providerId: string; readonly usage: AiUsage }
  | { readonly type: 'error'; readonly message: string };

export interface AiEmbeddingRequest {
  readonly consumer: AiConsumer;
  readonly model: AiModelSelector;
  readonly input: string | readonly string[];
}

export interface AiEmbeddingResult {
  readonly modelId: string;
  readonly providerId: string;
  readonly embeddings: readonly (readonly number[])[];
  readonly usage: AiUsage;
}

export interface AiUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedTokens?: number;
  readonly estimatedCostUsd?: number;
}

export interface AiUsageRecord extends AiUsage {
  readonly requestId: string;
  readonly consumerId: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly latencyMs: number;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly fallbackCount: number;
}

export interface ResolvedAiModel {
  readonly providerId: string;
  readonly modelId: string;
  readonly name: string;
  readonly capabilities: AiModelCapabilities;
  readonly contextWindow: number;
}

export interface AiCapabilityPermission {
  readonly id: string;
  readonly name: string;
  readonly risk: 'read' | 'write' | 'control' | 'privileged';
}

export const AI_CAPABILITIES: readonly AiCapabilityPermission[] = [
  { id: 'ai.generate', name: 'Generate', risk: 'write' },
  { id: 'ai.stream', name: 'Stream', risk: 'write' },
  { id: 'ai.embed', name: 'Embed', risk: 'write' },
  { id: 'ai.models.read', name: 'Read models', risk: 'read' },
  { id: 'ai.providers.read', name: 'Read providers', risk: 'read' },
  { id: 'ai.providers.configure', name: 'Configure providers', risk: 'control' },
  { id: 'ai.routing.read', name: 'Read routing', risk: 'read' },
  { id: 'ai.routing.configure', name: 'Configure routing', risk: 'control' },
  { id: 'ai.usage.read', name: 'Read usage', risk: 'read' },
  { id: 'ai.budgets.read', name: 'Read budgets', risk: 'read' },
  { id: 'ai.budgets.configure', name: 'Configure budgets', risk: 'control' },
];
