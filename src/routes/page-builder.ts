import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { PageService } from '../pagebuilder/service/page-service.js';
import { PageValidator } from '../pagebuilder/domain/page-validator.js';

const NodeSchema = Type.Any();

const PageDefinitionSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  route: Type.String(),
  layout: Type.Object({ type: Type.String(), content: NodeSchema }),
  nodes: Type.Array(NodeSchema),
  dataSources: Type.Array(Type.Any()),
  actions: Type.Array(Type.Any()),
  permissions: Type.Array(Type.Any()),
  responsive: Type.Array(Type.Any()),
  metadata: Type.Object({ title: Type.String(), authRequired: Type.Boolean() }),
  revision: Type.Integer(),
  updatedAt: Type.String(),
});

/**
 * PAGE-020 — Page Builder control API. Declarative page definitions; the
 * visual editor manipulates these, never generated code.
 */
export const pageBuilderRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const pages = app.application.container.resolve<PageService>('page-builder.service');
  const validator = new PageValidator({ has: (id) => pages.hasComponent(id) });

  app.get(
    '/api/v2/pages',
    {
      schema: {
        tags: ['page-builder'],
        summary: 'List page definitions',
        response: { 200: Type.Array(PageDefinitionSchema) },
      },
    },
    async (_request, reply) => reply.send(pages.list() as never),
  );

  app.post(
    '/api/v2/pages',
    {
      schema: {
        tags: ['page-builder'],
        summary: 'Create a page definition (declarative)',
        body: Type.Object({
          id: Type.String(),
          name: Type.String(),
          route: Type.String(),
          layout: Type.Any(),
          nodes: Type.Array(Type.Any()),
          dataSources: Type.Array(Type.Any()),
          actions: Type.Array(Type.Any()),
          permissions: Type.Array(Type.Any()),
          responsive: Type.Array(Type.Any()),
          metadata: Type.Object({ title: Type.String(), authRequired: Type.Boolean() }),
        }),
        response: { 201: PageDefinitionSchema },
      },
    },
    async (request, reply) => reply.status(201).send(pages.create(request.body as never) as never),
  );

  app.get(
    '/api/v2/pages/:id',
    {
      schema: {
        tags: ['page-builder'],
        summary: 'Get a page definition',
        params: Type.Object({ id: Type.String() }),
        response: { 200: PageDefinitionSchema },
      },
    },
    async (request, reply) => reply.send(pages.get(request.params.id) as never),
  );

  app.patch(
    '/api/v2/pages/:id',
    {
      schema: {
        tags: ['page-builder'],
        summary: 'Update a page definition (bumps revision)',
        params: Type.Object({ id: Type.String() }),
        body: Type.Any(),
        response: { 200: PageDefinitionSchema },
      },
    },
    async (request, reply) => reply.send(pages.update(request.params.id, request.body as never) as never),
  );

  app.post(
    '/api/v2/pages/:id/validate',
    {
      schema: {
        tags: ['page-builder'],
        summary: 'Validate a page (components, routes, bindings)',
        params: Type.Object({ id: Type.String() }),
        response: { 200: Type.Object({ ok: Type.Boolean(), issues: Type.Array(Type.Object({ path: Type.String(), message: Type.String(), severity: Type.String() })) }) },
      },
    },
    async (request, reply) => reply.send(validator.validate(pages.get(request.params.id)) as never),
  );

  app.delete(
    '/api/v2/pages/:id',
    {
      schema: {
        tags: ['page-builder'],
        summary: 'Delete a page definition',
        params: Type.Object({ id: Type.String() }),
        response: { 200: Type.Object({ deleted: Type.Boolean() }) },
      },
    },
    async (request, reply) => {
      pages.remove(request.params.id);
      return reply.send({ deleted: true } as never);
    },
  );
};
