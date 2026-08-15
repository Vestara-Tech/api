import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { AiService } from '../ai/runtime/ai-runtime.js';
import type { AiProviderRegistry } from '../ai/providers/provider-registry.js';
import type { AiModelCatalog } from '../ai/catalog/model-catalog.js';

const AiProviderViewSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  type: Type.String(),
  enabled: Type.Boolean(),
  priority: Type.Integer(),
  apiEndpoint: Type.Optional(Type.String()),
});

const AiModelViewSchema = Type.Object({
  id: Type.String(),
  providerId: Type.String(),
  name: Type.String(),
  capabilities: Type.Object({
    reasoning: Type.Boolean(),
    tools: Type.Boolean(),
    structuredOutput: Type.Boolean(),
    functionCalling: Type.Boolean(),
    vision: Type.Boolean(),
    embeddings: Type.Boolean(),
    streaming: Type.Boolean(),
  }),
  modalities: Type.Array(Type.String()),
  contextWindow: Type.Integer(),
  openWeight: Type.Boolean(),
  lifecycleStatus: Type.String(),
});

const AiModelQuerySchema = Type.Object({
  provider: Type.Optional(Type.String()),
  reasoning: Type.Optional(Type.String()),
  tools: Type.Optional(Type.String()),
  structuredOutput: Type.Optional(Type.String()),
  input: Type.Optional(Type.String()),
  minContext: Type.Optional(Type.String()),
});

const AiUsageViewSchema = Type.Object({
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

const AiResolveBodySchema = Type.Object({
  model: Type.Union([
    Type.Object({ provider: Type.String(), model: Type.String() }),
    Type.Object({
      requirements: Type.Object({
        reasoning: Type.Optional(Type.Boolean()),
        tools: Type.Optional(Type.Boolean()),
        structuredOutput: Type.Optional(Type.Boolean()),
        vision: Type.Optional(Type.Boolean()),
        minContext: Type.Optional(Type.Integer()),
      }),
      optimizeFor: Type.Optional(Type.String()),
    }),
  ]),
});

const AiErrorSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    requestId: Type.String(),
    correlationId: Type.String(),
    retryable: Type.Boolean(),
    details: Type.Optional(Type.Any()),
  }),
});

/**
 * AI-023 — AI control API. Read surfaces for providers, models, routing and
 * usage. `/generate`/`/stream` remain provider-gated (no live credentials in
 * this environment) and resolve + usage are exposed for observability.
 */
export const aiRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const ai = app.application.container.resolve<AiService>('ai');
  const providers = app.application.container.resolve<AiProviderRegistry>('ai.providers');
  const catalog = app.application.container.resolve<AiModelCatalog>('ai.catalog');

  app.get(
    '/api/v2/ai/providers',
    {
      schema: {
        tags: ['ai'],
        summary: 'List AI providers',
        response: { 200: Type.Array(AiProviderViewSchema) },
      },
    },
    async (_request, reply) => {
      const list = providers.listProviders().map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        enabled: p.enabled,
        priority: p.priority,
        ...(p.apiEndpoint !== undefined ? { apiEndpoint: p.apiEndpoint } : {}),
      }));
      return reply.send(list as never);
    },
  );

  app.get(
    '/api/v2/ai/providers/:id',
    {
      schema: {
        tags: ['ai'],
        summary: 'Get an AI provider',
        params: Type.Object({ id: Type.String() }),
        response: { 200: AiProviderViewSchema, 404: AiErrorSchema },
      },
    },
    async (request, reply) => {
      const provider = providers.getProvider(request.params.id);
      return reply.send({
        id: provider.id,
        name: provider.name,
        type: provider.type,
        enabled: provider.enabled,
        priority: provider.priority,
        ...(provider.apiEndpoint !== undefined ? { apiEndpoint: provider.apiEndpoint } : {}),
      } as never);
    },
  );

  app.get(
    '/api/v2/ai/models',
    {
      schema: {
        tags: ['ai'],
        summary: 'List models (filterable)',
        querystring: AiModelQuerySchema,
        response: { 200: Type.Array(AiModelViewSchema) },
      },
    },
    async (request, reply) => {
      const q = request.query;
      const list = catalog
        .list()
        .filter((m) => q.provider === undefined || m.providerId === q.provider)
        .filter((m) => q.reasoning === undefined || String(m.capabilities.reasoning) === q.reasoning)
        .filter((m) => q.tools === undefined || String(m.capabilities.tools) === q.tools)
        .filter((m) => q.structuredOutput === undefined || String(m.capabilities.structuredOutput) === q.structuredOutput)
        .filter((m) => q.input === undefined || m.modalities.includes(q.input as never))
        .filter((m) => q.minContext === undefined || m.contextWindow >= Number(q.minContext));
      return reply.send(list as never);
    },
  );

  app.get(
    '/api/v2/ai/models/:provider/:model',
    {
      schema: {
        tags: ['ai'],
        summary: 'Get a model',
        params: Type.Object({ provider: Type.String(), model: Type.String() }),
        response: { 200: AiModelViewSchema, 404: AiErrorSchema },
      },
    },
    async (request, reply) => {
      const model = catalog.get(request.params.provider, request.params.model);
      return reply.send(model as never);
    },
  );

  app.post(
    '/api/v2/ai/routing/resolve',
    {
      schema: {
        tags: ['ai'],
        summary: 'Resolve a model selector (capability or explicit)',
        body: AiResolveBodySchema,
        response: {
          200: Type.Object({
            providerId: Type.String(),
            modelId: Type.String(),
            name: Type.String(),
            contextWindow: Type.Integer(),
          }),
          404: AiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const resolved = await ai.resolveModel(request.body.model as never);
      return reply.send(resolved as never);
    },
  );

  app.get(
    '/api/v2/ai/usage',
    {
      schema: {
        tags: ['ai'],
        summary: 'List AI usage records',
        querystring: Type.Object({ consumerId: Type.Optional(Type.String()) }),
        response: { 200: Type.Array(AiUsageViewSchema) },
      },
    },
    async (request, reply) => {
      const records = ai.recentUsage(request.query.consumerId);
      return reply.send(records as never);
    },
  );

  app.get(
    '/api/v2/ai/capabilities',
    {
      schema: {
        tags: ['ai'],
        summary: 'List AI capability permissions',
        response: {
          200: Type.Array(
            Type.Object({
              id: Type.String(),
              name: Type.String(),
              risk: Type.String(),
            }),
          ),
        },
      },
    },
    async (_request, reply) => {
      const { AI_CAPABILITIES } = await import('../ai/domain/contracts.js');
      return reply.send(AI_CAPABILITIES as never);
    },
  );
};
