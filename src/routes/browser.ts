import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { BrowserService } from '../browser/service/browser-service.js';
import type { BrowserRuntimeRegistry } from '../browser/registry/browser-runtime-registry.js';

const ProfileSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  runtime: Type.String(),
  browser: Type.String(),
  headless: Type.Boolean(),
  allowedDomains: Type.Optional(Type.Array(Type.String())),
  blockedDomains: Type.Optional(Type.Array(Type.String())),
});

const SessionSchema = Type.Object({ id: Type.String(), profileId: Type.String(), runtime: Type.String(), status: Type.String(), tabs: Type.Array(Type.Object({ id: Type.String(), url: Type.String() })) });

const NavigateBodySchema = Type.Object({ sessionId: Type.String(), url: Type.String(), hasPermission: Type.Boolean() });

/**
 * BRW — Browser control API. Profiles, sessions, governed navigation (policy
 * gate), evidence. Agents request capabilities; the Browser Module decides.
 */
export const browserRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const service = app.application.container.resolve<BrowserService>('browser.service');
  const runtimes = app.application.container.resolve<BrowserRuntimeRegistry>('browser.runtimes');

  app.get(
    '/api/v2/browser/runtimes',
    {
      schema: {
        tags: ['browser'],
        summary: 'List browser runtimes and their capabilities',
        response: {
          200: Type.Array(Type.Object({ id: Type.String(), deterministic: Type.Boolean(), agentic: Type.Boolean(), humanTakeover: Type.Boolean() })),
        },
      },
    },
    async (_request, reply) => {
      const views = await Promise.all(runtimes.list().map(async (rt) => {
        const c = await rt.capabilities();
        return { id: rt.id, deterministic: c.deterministic, agentic: c.agentic, humanTakeover: c.humanTakeover };
      }));
      return reply.send(views as never);
    },
  );

  app.post(
    '/api/v2/browser/profiles',
    {
      schema: {
        tags: ['browser'],
        summary: 'Register a browser profile',
        body: ProfileSchema,
        response: { 201: ProfileSchema },
      },
    },
    async (request, reply) => reply.status(201).send(service.registerProfile(request.body as never) as never),
  );

  app.get(
    '/api/v2/browser/profiles',
    {
      schema: {
        tags: ['browser'],
        summary: 'List browser profiles',
        response: { 200: Type.Array(ProfileSchema) },
      },
    },
    async (_request, reply) => reply.send(service.listProfiles() as never),
  );

  app.post(
    '/api/v2/browser/sessions',
    {
      schema: {
        tags: ['browser'],
        summary: 'Create a browser session',
        body: Type.Object({ profileId: Type.String(), runtime: Type.String() }),
        response: { 201: SessionSchema },
      },
    },
    async (request, reply) => reply.status(201).send((await service.createSession(request.body.profileId, request.body.runtime as never)) as never),
  );

  app.get(
    '/api/v2/browser/sessions',
    {
      schema: {
        tags: ['browser'],
        summary: 'List browser sessions',
        response: { 200: Type.Array(SessionSchema) },
      },
    },
    async (_request, reply) => reply.send(service.listSessions() as never),
  );

  app.post(
    '/api/v2/browser/navigate',
    {
      schema: {
        tags: ['browser'],
        summary: 'Navigate a session (policy-gated)',
        body: NavigateBodySchema,
        response: {
          200: Type.Object({
            action: Type.Object({ id: Type.String(), kind: Type.String(), url: Type.Optional(Type.String()) }),
            evidence: Type.Object({ sessionId: Type.String(), action: Type.String(), url: Type.String(), runtime: Type.String() }),
          }),
        },
      },
    },
    async (request, reply) => reply.send((await service.navigate(request.body.sessionId, request.body.url, request.body.hasPermission)) as never),
  );

  app.get(
    '/api/v2/browser/evidence',
    {
      schema: {
        tags: ['browser'],
        summary: 'List browser action evidence',
        response: {
          200: Type.Array(Type.Object({ sessionId: Type.String(), action: Type.String(), url: Type.String(), runtime: Type.String(), timestamp: Type.String() })),
        },
      },
    },
    async (_request, reply) => reply.send(service.evidence() as never),
  );
};
