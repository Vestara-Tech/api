import { Type, type Static } from '@sinclair/typebox';

export const AiConsumerSchema = Type.Object({
  type: Type.Union([Type.Literal('module'), Type.Literal('agent'), Type.Literal('workflow'), Type.Literal('service'), Type.Literal('user')]),
  id: Type.String(),
});

export const AiRoleSchema = Type.Union([Type.Literal('system'), Type.Literal('user'), Type.Literal('assistant'), Type.Literal('tool')]);

export const AiToolCallSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  arguments: Type.String(),
});

export const AiMessageSchema = Type.Object({
  role: AiRoleSchema,
  content: Type.Union([Type.String(), Type.Array(Type.Object({ type: Type.String(), value: Type.String(), mediaType: Type.Optional(Type.String()) }))]),
  name: Type.Optional(Type.String()),
  toolCalls: Type.Optional(Type.Array(AiToolCallSchema)),
  toolCallId: Type.Optional(Type.String()),
});

export const AiToolDefinitionSchema = Type.Object({
  name: Type.String(),
  description: Type.String(),
  inputSchema: Type.Any(),
});

export const AiModelSelectorSchema = Type.Union([
  Type.Object({ provider: Type.String(), model: Type.String() }),
  Type.Object({
    requirements: Type.Object({
      reasoning: Type.Optional(Type.Boolean()),
      tools: Type.Optional(Type.Boolean()),
      structuredOutput: Type.Optional(Type.Boolean()),
      functionCalling: Type.Optional(Type.Boolean()),
      vision: Type.Optional(Type.Boolean()),
      embeddings: Type.Optional(Type.Boolean()),
      input: Type.Optional(Type.Array(Type.String())),
      minContext: Type.Optional(Type.Integer()),
    }),
    optimizeFor: Type.Optional(Type.String()),
  }),
]);

export const AiGenerateRequestSchema = Type.Object({
  consumer: AiConsumerSchema,
  model: AiModelSelectorSchema,
  messages: Type.Array(AiMessageSchema),
  system: Type.Optional(Type.String()),
  tools: Type.Optional(Type.Array(AiToolDefinitionSchema)),
  output: Type.Optional(Type.Object({ schema: Type.Any() })),
  temperature: Type.Optional(Type.Number()),
  maxTokens: Type.Optional(Type.Integer()),
  fallbackCount: Type.Optional(Type.Integer()),
});

export const AiUsageSchema = Type.Object({
  inputTokens: Type.Integer(),
  outputTokens: Type.Integer(),
  cachedTokens: Type.Optional(Type.Integer()),
  estimatedCostUsd: Type.Optional(Type.Number()),
});

export const AiGenerateResultSchema = Type.Object({
  content: Type.String(),
  modelId: Type.String(),
  providerId: Type.String(),
  usage: AiUsageSchema,
  latencyMs: Type.Integer(),
  fallbackCount: Type.Integer(),
  toolCalls: Type.Optional(Type.Array(AiToolCallSchema)),
});

export const AiStreamEventSchema = Type.Union([
  Type.Object({ type: Type.Literal('chunk'), text: Type.String() }),
  Type.Object({ type: Type.Literal('tool-call'), toolCall: AiToolCallSchema }),
  Type.Object({ type: Type.Literal('done'), modelId: Type.String(), providerId: Type.String(), usage: AiUsageSchema }),
  Type.Object({ type: Type.Literal('error'), message: Type.String() }),
]);

export const AiUsageRecordSchema = Type.Object({
  requestId: Type.String(),
  consumerId: Type.String(),
  providerId: Type.String(),
  modelId: Type.String(),
  inputTokens: Type.Integer(),
  outputTokens: Type.Integer(),
  cachedTokens: Type.Optional(Type.Integer()),
  estimatedCostUsd: Type.Optional(Type.Number()),
  latencyMs: Type.Integer(),
  startedAt: Type.String(),
  completedAt: Type.String(),
  fallbackCount: Type.Integer(),
});

export type AiGenerateRequestContract = Static<typeof AiGenerateRequestSchema>;
export type AiGenerateResultContract = Static<typeof AiGenerateResultSchema>;
export type AiStreamEventContract = Static<typeof AiStreamEventSchema>;
export type AiUsageContract = Static<typeof AiUsageSchema>;
export type AiMessageContract = Static<typeof AiMessageSchema>;
export type AiToolCallContract = Static<typeof AiToolCallSchema>;
export type AiToolDefinitionContract = Static<typeof AiToolDefinitionSchema>;
export type AiUsageRecordContract = Static<typeof AiUsageRecordSchema>;
