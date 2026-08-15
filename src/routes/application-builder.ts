import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { ApplicationBuilderService } from '../appbuilder/service/application-builder-service.js';

const ApplicationSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  version: Type.String(),
  applicationType: Type.String(),
  pages: Type.Array(Type.Object({ pageId: Type.String(), path: Type.String(), default: Type.Optional(Type.Boolean()) })),
  routes: Type.Array(Type.Object({ path: Type.String(), pageId: Type.String(), authRequired: Type.Boolean() })),
  navigation: Type.Array(Type.Any()),
  apis: Type.Array(Type.Any()),
  databases: Type.Array(Type.Any()),
  authentication: Type.Object({ enabled: Type.Boolean(), provider: Type.String() }),
  permissions: Type.Array(Type.Any()),
  workflows: Type.Array(Type.String()),
  agents: Type.Array(Type.String()),
  configuration: Type.Array(Type.String()),
  integrations: Type.Array(Type.String()),
  state: Type.Array(Type.Any()),
  lifecycle: Type.String(),
  revision: Type.Integer(),
  updatedAt: Type.String(),
});

/**
 * APP-024 — Application Builder control API. Applications compose pages +
 * routes + navigation + APIs + auth + workflows; the declarative definition
 * is the source of truth.
 */
export const applicationBuilderRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const applications = app.application.container.resolve<ApplicationBuilderService>('application-builder.service');

  app.get(
    '/api/v2/applications',
    {
      schema: {
        tags: ['application-builder'],
        summary: 'List application definitions',
        response: { 200: Type.Array(ApplicationSchema) },
      },
    },
    async (_request, reply) => reply.send(applications.list() as never),
  );

  app.post(
    '/api/v2/applications',
    {
      schema: {
        tags: ['application-builder'],
        summary: 'Create an application definition (declarative)',
        body: Type.Object({
          id: Type.String(),
          name: Type.String(),
          version: Type.String(),
          applicationType: Type.String(),
          pages: Type.Array(Type.Any()),
          routes: Type.Array(Type.Any()),
          navigation: Type.Array(Type.Any()),
          apis: Type.Array(Type.Any()),
          databases: Type.Array(Type.Any()),
          authentication: Type.Object({ enabled: Type.Boolean(), provider: Type.String() }),
          permissions: Type.Array(Type.Any()),
          workflows: Type.Array(Type.String()),
          agents: Type.Array(Type.String()),
          configuration: Type.Array(Type.String()),
          integrations: Type.Array(Type.String()),
          state: Type.Array(Type.Any()),
        }),
        response: { 201: ApplicationSchema },
      },
    },
    async (request, reply) => reply.status(201).send(applications.create(request.body as never) as never),
  );

  app.get(
    '/api/v2/applications/:id',
    {
      schema: {
        tags: ['application-builder'],
        summary: 'Get an application definition',
        params: Type.Object({ id: Type.String() }),
        response: { 200: ApplicationSchema },
      },
    },
    async (request, reply) => reply.send(applications.get(request.params.id) as never),
  );

  app.get(
    '/api/v2/applications/:id/model',
    {
      schema: {
        tags: ['application-builder'],
        summary: 'Application model (definition + resolved pages)',
        params: Type.Object({ id: Type.String() }),
        response: { 200: Type.Object({ definition: ApplicationSchema, pages: Type.Array(Type.Any()), lifecycle: Type.String() }) },
      },
    },
    async (request, reply) => reply.send(applications.model(request.params.id) as never),
  );

  app.post(
    '/api/v2/applications/:id/transition',
    {
      schema: {
        tags: ['application-builder'],
        summary: 'Transition application lifecycle (draft -> planning -> building -> ready -> published)',
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({ to: Type.String() }),
        response: { 200: ApplicationSchema },
      },
    },
    async (request, reply) => reply.send(applications.transition(request.params.id, request.body.to as never) as never),
  );

  app.patch(
    '/api/v2/applications/:id',
    {
      schema: {
        tags: ['application-builder'],
        summary: 'Update an application definition (bumps revision, validates)',
        params: Type.Object({ id: Type.String() }),
        body: Type.Any(),
        response: { 200: ApplicationSchema },
      },
    },
    async (request, reply) => reply.send(applications.update(request.params.id, request.body as never) as never),
  );

  app.delete(
    '/api/v2/applications/:id',
    {
      schema: {
        tags: ['application-builder'],
        summary: 'Delete an application definition',
        params: Type.Object({ id: Type.String() }),
        response: { 200: Type.Object({ deleted: Type.Boolean() }) },
      },
    },
    async (request, reply) => {
      applications.remove(request.params.id);
      return reply.send({ deleted: true } as never);
    },
  );
};
