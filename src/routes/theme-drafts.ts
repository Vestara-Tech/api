import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { ThemeDraftService } from '../theme/service/theme-draft-service.js';
import type { ThemeDraft, ThemeDraftCreateInput, ThemeDraftUpdateInput, ThemeDraftStatus } from '../theme/domain/theme-draft.js';
import type { SemanticTokenDraft } from '../theme/domain/generation.js';

const ThemeDraftStatusSchema = Type.Union([Type.Literal('draft'), Type.Literal('published'), Type.Literal('archived')]);

const ThemeDraftSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  description: Type.String(),
  draft: Type.Any(),
  baseThemeId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  version: Type.String(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
  status: ThemeDraftStatusSchema,
});

const ThemeDraftCreateSchema = Type.Object({
  name: Type.String(),
  description: Type.String(),
  draft: Type.Any(),
  baseThemeId: Type.Optional(Type.String()),
});

const ThemeDraftUpdateSchema = Type.Object({
  name: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  draft: Type.Optional(Type.Any()),
  baseThemeId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  status: Type.Optional(ThemeDraftStatusSchema),
});

const PublishResponseSchema = Type.Object({
  themeDraft: ThemeDraftSchema,
  theme: Type.Any(),
});

export const themeDraftRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const drafts = app.application.container.resolve<ThemeDraftService>('theme-drafts');

  app.get(
    '/api/v2/theme-drafts',
    {
      schema: {
        tags: ['theme-drafts'],
        summary: 'List theme drafts',
        response: { 200: Type.Array(ThemeDraftSchema) },
      },
    },
    async (_request, reply) => reply.send(drafts.list() as never),
  );

  app.get(
    '/api/v2/theme-drafts/:id',
    {
      schema: {
        tags: ['theme-drafts'],
        summary: 'Get a theme draft',
        params: Type.Object({ id: Type.String() }),
        response: { 200: ThemeDraftSchema },
      },
    },
    async (request, reply) => reply.send(drafts.get(request.params.id) as never),
  );

  app.post(
    '/api/v2/theme-drafts',
    {
      schema: {
        tags: ['theme-drafts'],
        summary: 'Create a theme draft',
        body: ThemeDraftCreateSchema,
        response: { 201: ThemeDraftSchema },
      },
    },
    async (request, reply) => reply.status(201).send(drafts.create(request.body as ThemeDraftCreateInput) as never),
  );

  app.put(
    '/api/v2/theme-drafts/:id',
    {
      schema: {
        tags: ['theme-drafts'],
        summary: 'Update a theme draft',
        params: Type.Object({ id: Type.String() }),
        body: ThemeDraftUpdateSchema,
        response: { 200: ThemeDraftSchema },
      },
    },
    async (request, reply) => reply.send(drafts.update(request.params.id, request.body as ThemeDraftUpdateInput) as never),
  );

  app.delete(
    '/api/v2/theme-drafts/:id',
    {
      schema: {
        tags: ['theme-drafts'],
        summary: 'Delete a theme draft',
        params: Type.Object({ id: Type.String() }),
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      drafts.delete(request.params.id);
      return reply.status(204).send(null);
    },
  );

  app.post(
    '/api/v2/theme-drafts/:id/publish',
    {
      schema: {
        tags: ['theme-drafts'],
        summary: 'Publish a theme draft as a versioned theme',
        params: Type.Object({ id: Type.String() }),
        response: { 200: PublishResponseSchema },
      },
    },
    async (request, reply) => reply.send(drafts.publish(request.params.id) as never),
  );

  app.post(
    '/api/v2/theme-drafts/:id/archive',
    {
      schema: {
        tags: ['theme-drafts'],
        summary: 'Archive a theme draft',
        params: Type.Object({ id: Type.String() }),
        response: { 200: ThemeDraftSchema },
      },
    },
    async (request, reply) => reply.send(drafts.archive(request.params.id) as never),
  );
};