import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { AiPlatformV2 } from '../ai/v2/ai-platform-v2.js';
import type { AiSessionManager } from '../ai/v2/session.js';
import type { BudgetEngine } from '../ai/v2/budget.js';
import type { UsageAggregator } from '../ai/v2/usage.js';
import type { AiTracer } from '../ai/v2/trace.js';

const ProfileSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  description: Type.Optional(Type.String()),
  requirements: Type.Object({ reasoning: Type.Optional(Type.Boolean()), tools: Type.Optional(Type.Boolean()), structuredOutput: Type.Optional(Type.Boolean()), minContext: Type.Optional(Type.Integer()) }),
  strategy: Type.String(),
  parameters: Type.Object({ temperature: Type.Optional(Type.Number()), maxTokens: Type.Optional(Type.Integer()) }),
  budget: Type.Optional(Type.Object({ maxTokensPerRequest: Type.Optional(Type.Integer()) })),
  tags: Type.Array(Type.String()),
});

const ProviderStateSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  installed: Type.Boolean(),
  configured: Type.Boolean(),
  enabled: Type.Boolean(),
  credentialRef: Type.Optional(Type.String()),
  health: Type.String(),
  lastCheckedAt: Type.Optional(Type.String()),
});

const RoutingDecisionSchema = Type.Object({
  resolved: Type.Object({ providerId: Type.String(), modelId: Type.String(), name: Type.String(), contextWindow: Type.Integer() }),
  profileId: Type.String(),
  strategy: Type.String(),
  fallbackChain: Type.Array(Type.String()),
  selectedFrom: Type.String(),
  reason: Type.String(),
  at: Type.String(),
});

/**
 * AI2 — AI Platform v2 control API. Profiles, provider states and the
 * profile-aware routing engine.
 */
export const aiPlatformV2Routes: FastifyPluginAsyncTypebox = async (app) => {
  const ai = app.application.container.resolve<AiPlatformV2>('ai.v2');
  const sessions = app.application.container.resolve<AiSessionManager>('ai.v2.sessions');
  const budgets = app.application.container.resolve<BudgetEngine>('ai.v2.budgets');
  const usage = app.application.container.resolve<UsageAggregator>('ai.v2.usage');
  const tracer = app.application.container.resolve<AiTracer>('ai.v2.tracer');

  app.get(
    '/api/v2/ai/v2/profiles',
    {
      schema: {
        tags: ['ai'],
        summary: 'List AI profiles (named model configurations)',
        response: { 200: Type.Array(ProfileSchema) },
      },
    },
    async (_request, reply) => reply.send(ai.profiles.list() as never),
  );

  app.get(
    '/api/v2/ai/v2/profiles/:id',
    {
      schema: {
        tags: ['ai'],
        summary: 'Get an AI profile',
        params: Type.Object({ id: Type.String() }),
        response: { 200: ProfileSchema },
      },
    },
    async (request, reply) => reply.send(ai.profiles.get(request.params.id) as never),
  );

  app.post(
    '/api/v2/ai/v2/profiles',
    {
      schema: {
        tags: ['ai'],
        summary: 'Register an AI profile',
        body: ProfileSchema,
        response: { 201: ProfileSchema },
      },
    },
    async (request, reply) => {
      ai.profiles.save(request.body as never);
      return reply.status(201).send(request.body as never);
    },
  );

  app.get(
    '/api/v2/ai/v2/providers',
    {
      schema: {
        tags: ['ai'],
        summary: 'List provider lifecycle states (installed/configured/enabled + health)',
        response: { 200: Type.Array(ProviderStateSchema) },
      },
    },
    async (_request, reply) => reply.send(ai.providerStates.listProviderStates() as never),
  );

  app.post(
    '/api/v2/ai/v2/providers',
    {
      schema: {
        tags: ['ai'],
        summary: 'Upsert provider state (credentials remain secret references)',
        body: ProviderStateSchema,
        response: { 200: ProviderStateSchema },
      },
    },
    async (request, reply) => {
      ai.providerStates.upsert(request.body as never);
      return reply.send(request.body as never);
    },
  );

  app.post(
    '/api/v2/ai/v2/route',
    {
      schema: {
        tags: ['ai'],
        summary: 'Route a profile to a concrete model (explainable decision)',
        body: Type.Object({ profileId: Type.String() }),
        response: {
          200: RoutingDecisionSchema,
          404: Type.Object({ error: Type.Object({ code: Type.String(), message: Type.String() }) }),
        },
      },
    },
    async (request, reply) => {
      const profile = ai.profiles.get(request.body.profileId);
      if (!profile) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: `Profile "${request.body.profileId}" not found` } } as never);
      }
      return reply.send(ai.router.route(profile) as never);
    },
  );

  app.post(
    '/api/v2/ai/v2/route/eligible',
    {
      schema: {
        tags: ['ai'],
        summary: 'List eligible models for a profile',
        body: Type.Object({ profileId: Type.String() }),
        response: {
          200: Type.Array(Type.Object({ providerId: Type.String(), modelId: Type.String(), name: Type.String(), contextWindow: Type.Integer() })),
          404: Type.Object({ error: Type.Object({ code: Type.String(), message: Type.String() }) }),
        },
      },
    },
    async (request, reply) => {
      const profile = ai.profiles.get(request.body.profileId);
      if (!profile) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: `Profile "${request.body.profileId}" not found` } } as never);
      }
      return reply.send(ai.router.listEligible(profile) as never);
    },
  );

  // ── AI2-011..019 sessions / budget / usage / trace ──────────
  const SessionViewSchema = Type.Object({
    id: Type.String(),
    consumerId: Type.String(),
    profileId: Type.String(),
    createdAt: Type.String(),
    updatedAt: Type.String(),
    title: Type.Optional(Type.String()),
    requestCount: Type.Integer(),
    inputTokens: Type.Integer(),
    outputTokens: Type.Integer(),
    estimatedCostUsd: Type.Number(),
  });

  app.post(
    '/api/v2/ai/v2/sessions',
    {
      schema: {
        tags: ['ai'],
        summary: 'Create a durable AI session',
        body: Type.Object({ consumerId: Type.String(), profileId: Type.String(), title: Type.Optional(Type.String()) }),
        response: { 201: SessionViewSchema },
      },
    },
    async (request, reply) => reply.status(201).send(sessions.createSession(request.body as never) as never),
  );

  app.get(
    '/api/v2/ai/v2/sessions',
    {
      schema: {
        tags: ['ai'],
        summary: 'List AI sessions',
        response: { 200: Type.Array(SessionViewSchema) },
      },
    },
    async (_request, reply) => reply.send(sessions.listSessions() as never),
  );

  app.get(
    '/api/v2/ai/v2/sessions/:id',
    {
      schema: {
        tags: ['ai'],
        summary: 'Get an AI session',
        params: Type.Object({ id: Type.String() }),
        response: {
          200: SessionViewSchema,
          404: Type.Object({ error: Type.Object({ code: Type.String(), message: Type.String() }) }),
        },
      },
    },
    async (request, reply) => {
      const session = sessions.getSession(request.params.id);
      if (!session) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Session not found' } } as never);
      return reply.send(session as never);
    },
  );

  app.post(
    '/api/v2/ai/v2/sessions/:id/conversations',
    {
      schema: {
        tags: ['ai'],
        summary: 'Start a conversation in a session',
        params: Type.Object({ id: Type.String() }),
        response: { 201: Type.Object({ id: Type.String(), sessionId: Type.String(), messages: Type.Array(Type.Any()), createdAt: Type.String() }) },
      },
    },
    async (request, reply) => {
      const conversation = sessions.newConversation(request.params.id);
      return reply.status(201).send(conversation as never);
    },
  );

  app.post(
    '/api/v2/ai/v2/conversations/:id/messages',
    {
      schema: {
        tags: ['ai'],
        summary: 'Append a message to a conversation',
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({ role: Type.String(), content: Type.Any() }),
        response: { 200: Type.Object({ id: Type.String(), sessionId: Type.String(), messages: Type.Array(Type.Any()) }) },
      },
    },
    async (request, reply) => reply.send(sessions.appendMessage(request.params.id, request.body as never) as never),
  );

  app.post(
    '/api/v2/ai/v2/budgets',
    {
      schema: {
        tags: ['ai'],
        summary: 'Set a budget limit (system/organization/user/module/agent/workflow/task/session)',
        body: Type.Object({
          scope: Type.String(),
          scopeId: Type.String(),
          dailyUsd: Type.Optional(Type.Number()),
          perRunUsd: Type.Optional(Type.Number()),
          tokenLimit: Type.Optional(Type.Integer()),
          maxRequests: Type.Optional(Type.Integer()),
          onThreshold: Type.String(),
          thresholdRatio: Type.Number(),
        }),
        response: { 200: Type.Object({ set: Type.Boolean() }) },
      },
    },
    async (request, reply) => {
      budgets.setLimit(request.body as never);
      return reply.send({ set: true } as never);
    },
  );

  app.get(
    '/api/v2/ai/v2/usage',
    {
      schema: {
        tags: ['ai'],
        summary: 'Aggregate AI usage',
        response: { 200: Type.Object({ requests: Type.Integer(), inputTokens: Type.Integer(), outputTokens: Type.Integer(), costUsd: Type.Number(), successRate: Type.Number(), p95LatencyMs: Type.Integer() }) },
      },
    },
    async (_request, reply) => reply.send(usage.aggregate() as never),
  );

  app.get(
    '/api/v2/ai/v2/usage/grouped',
    {
      schema: {
        tags: ['ai'],
        summary: 'Usage grouped by provider/model/module/agent/user',
        querystring: Type.Object({ by: Type.Optional(Type.String()) }),
        response: { 200: Type.Object({ groupBy: Type.String(), groups: Type.Array(Type.Object({ key: Type.String(), requests: Type.Integer(), tokens: Type.Integer(), costUsd: Type.Number() })) }) },
      },
    },
    async (request, reply) => reply.send(usage.groupBy((request.query.by ?? 'provider') as never) as never),
  );

  app.get(
    '/api/v2/ai/v2/traces',
    {
      schema: {
        tags: ['ai'],
        summary: 'List AI traces',
        response: { 200: Type.Array(Type.Object({ traceId: Type.String(), requestId: Type.String(), providerId: Type.String(), modelId: Type.String(), totalMs: Type.Integer(), at: Type.String() })) },
      },
    },
    async (_request, reply) => reply.send(tracer.list() as never),
  );

  app.get(
    '/api/v2/ai/v2/traces/:id',
    {
      schema: {
        tags: ['ai'],
        summary: 'Get an AI trace with steps',
        params: Type.Object({ id: Type.String() }),
        response: {
          200: Type.Object({ traceId: Type.String(), requestId: Type.String(), providerId: Type.String(), modelId: Type.String(), steps: Type.Array(Type.Object({ name: Type.String(), durationMs: Type.Integer() })), totalMs: Type.Integer(), at: Type.String() }),
          404: Type.Object({ error: Type.Object({ code: Type.String(), message: Type.String() }) }),
        },
      },
    },
    async (request, reply) => {
      const trace = tracer.get(request.params.id);
      if (!trace) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Trace not found' } } as never);
      return reply.send(trace as never);
    },
  );
};
