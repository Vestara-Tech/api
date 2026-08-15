import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { AiPlatformV2 } from '../ai/v2/ai-platform-v2.js';

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
};
