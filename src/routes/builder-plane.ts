import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { BuilderLifecycle } from '../builder-plane/lifecycle.js';
import type { BuilderRegistry } from '../builder-plane/registry.js';
import type { BuilderStore } from '../builder-plane/store.js';
import type { BuilderPlane } from '../builder-plane/session.js';

const DefinitionViewSchema = Type.Object({
  id: Type.String(),
  kind: Type.String(),
  name: Type.String(),
  revision: Type.Integer(),
  status: Type.String(),
  updatedAt: Type.String(),
});

const CreateBodySchema = Type.Object({
  id: Type.String(),
  kind: Type.String(),
  name: Type.String(),
  spec: Type.Any(),
  description: Type.Optional(Type.String()),
});

/**
 * BLD-X — Builder control API. Generic builder plane: definitions, lifecycle
 * (validate/publish/supersede/archive), kinds.
 */
export const builderPlaneRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const registry = app.application.container.resolve<BuilderRegistry>('builder.plane.registry');
  const store = app.application.container.resolve<BuilderStore>('builder.plane.store');
  const lifecycle = app.application.container.resolve<BuilderLifecycle>('builder.plane.lifecycle');
  const plane = app.application.container.resolve<BuilderPlane>('builder.plane.sessions');

  app.get(
    '/api/v2/builders/kinds',
    {
      schema: {
        tags: ['builders'],
        summary: 'List builder kinds (from BuilderRegistry contributions)',
        response: { 200: Type.Array(Type.Object({ kind: Type.String(), moduleId: Type.String(), version: Type.String(), capabilities: Type.Array(Type.String()) })) },
      },
    },
    async (_request, reply) => reply.send(registry.listKinds() as never),
  );

  app.post(
    '/api/v2/builders/definitions',
    {
      schema: {
        tags: ['builders'],
        summary: 'Create a builder definition (any kind)',
        body: CreateBodySchema,
        response: { 201: DefinitionViewSchema },
      },
    },
    async (request, reply) => {
      const definition = store.create({
        id: request.body.id,
        kind: request.body.kind,
        name: request.body.name,
        spec: request.body.spec,
        ...(request.body.description !== undefined ? { description: request.body.description } : {}),
      });
      return reply.status(201).send(toView(definition) as never);
    },
  );

  app.get(
    '/api/v2/builders/definitions/:id',
    {
      schema: {
        tags: ['builders'],
        summary: 'Get a builder definition',
        params: Type.Object({ id: Type.String() }),
        response: { 200: DefinitionViewSchema },
      },
    },
    async (request, reply) => reply.send(toView(store.get(request.params.id)) as never),
  );

  app.post(
    '/api/v2/builders/definitions/:id/validate',
    {
      schema: {
        tags: ['builders'],
        summary: 'Validate a builder definition against its contribution validator',
        params: Type.Object({ id: Type.String() }),
        response: { 200: DefinitionViewSchema },
      },
    },
    async (request, reply) => reply.send(toView(lifecycle.validate(request.params.id)) as never),
  );

  app.post(
    '/api/v2/builders/definitions/:id/publish',
    {
      schema: {
        tags: ['builders'],
        summary: 'Publish a builder definition (records a revision)',
        params: Type.Object({ id: Type.String() }),
        response: { 200: DefinitionViewSchema },
      },
    },
    async (request, reply) => reply.send(toView(lifecycle.publish(request.params.id)) as never),
  );

  app.get(
    '/api/v2/builders/definitions/:id/revisions',
    {
      schema: {
        tags: ['builders'],
        summary: 'Builder definition revision history',
        params: Type.Object({ id: Type.String() }),
        response: {
          200: Type.Array(Type.Object({ revision: Type.Integer(), recordedAt: Type.String(), status: Type.String() })),
        },
      },
    },
    async (request, reply) =>
      reply.send(store.listRevisions(request.params.id).map((r) => ({ revision: r.revision, recordedAt: r.recordedAt, status: r.definition.status })) as never),
  );

  // ── BLD-X v2 sessions ──────────────────────────────────────
  const SessionViewSchema = Type.Object({
    sessionId: Type.String(),
    draftId: Type.String(),
    status: Type.String(),
    draft: DefinitionViewSchema,
  });

  app.post(
    '/api/v2/builders/sessions',
    {
      schema: {
        tags: ['builders'],
        summary: 'Open a builder session (shared lifecycle across all builders)',
        body: Type.Object({ kind: Type.String(), baseDefinitionId: Type.Optional(Type.String()) }),
        response: { 201: SessionViewSchema },
      },
    },
    async (request, reply) => {
      const session = plane.openSession(request.body.kind as never, request.body.baseDefinitionId);
      return reply.status(201).send({ sessionId: session.getSession().sessionId, draftId: session.getSession().draftId, status: session.getSession().status, draft: toView(session.getDraft()) } as never);
    },
  );

  app.patch(
    '/api/v2/builders/sessions/:sessionId',
    {
      schema: {
        tags: ['builders'],
        summary: 'Configure the session draft (spec)',
        params: Type.Object({ sessionId: Type.String() }),
        body: Type.Object({ spec: Type.Any() }),
        response: { 200: SessionViewSchema },
      },
    },
    async (request, reply) => {
      const session = plane.getSession(request.params.sessionId);
      const draft = session.configure(request.body.spec as never);
      return reply.send({ sessionId: session.getSession().sessionId, draftId: session.getSession().draftId, status: session.getSession().status, draft: toView(draft) } as never);
    },
  );

  app.post(
    '/api/v2/builders/sessions/:sessionId/validate',
    {
      schema: {
        tags: ['builders'],
        summary: 'Validate the session draft against its contribution validator',
        params: Type.Object({ sessionId: Type.String() }),
        response: { 200: Type.Object({ ok: Type.Boolean(), issues: Type.Array(Type.Object({ path: Type.String(), message: Type.String(), severity: Type.String() })) }) },
      },
    },
    async (request, reply) => reply.send(plane.validateDraft(request.params.sessionId) as never),
  );

  app.post(
    '/api/v2/builders/sessions/:sessionId/publish',
    {
      schema: {
        tags: ['builders'],
        summary: 'Publish the session draft (create -> configure -> validate -> preview -> test -> publish)',
        params: Type.Object({ sessionId: Type.String() }),
        response: { 200: DefinitionViewSchema },
      },
    },
    async (request, reply) => reply.send(toView(plane.publishSession(request.params.sessionId)) as never),
  );

  app.get(
    '/api/v2/builders/sessions',
    {
      schema: {
        tags: ['builders'],
        summary: 'List active builder sessions',
        response: { 200: Type.Array(Type.Object({ sessionId: Type.String(), draftId: Type.String(), status: Type.String(), startedAt: Type.String() })) },
      },
    },
    async (_request, reply) => reply.send(plane.activeSessions() as never),
  );

  app.delete(
    '/api/v2/builders/sessions/:sessionId',
    {
      schema: {
        tags: ['builders'],
        summary: 'Discard a builder session',
        params: Type.Object({ sessionId: Type.String() }),
        response: { 200: Type.Object({ discarded: Type.Boolean() }) },
      },
    },
    async (request, reply) => {
      plane.discard(request.params.sessionId);
      return reply.send({ discarded: true } as never);
    },
  );
};

function toView(d: { id: string; kind: string; name: string; revision: number; status: string; metadata: { updatedAt: string } }) {
  return { id: d.id, kind: d.kind, name: d.name, revision: d.revision, status: d.status, updatedAt: d.metadata.updatedAt };
}
