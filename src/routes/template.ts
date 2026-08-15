import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { TemplateService } from '../template/service/template-service.js';

const ParameterSchema = Type.Object({
  name: Type.String(),
  type: Type.String(),
  required: Type.Optional(Type.Boolean()),
  defaultValue: Type.Optional(Type.Any()),
  enumValues: Type.Optional(Type.Array(Type.String())),
  description: Type.Optional(Type.String()),
});

const TemplateSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  version: Type.String(),
  kind: Type.String(),
  description: Type.Optional(Type.String()),
  tags: Type.Array(Type.String()),
  parameters: Type.Array(ParameterSchema),
  definition: Type.Any(),
  recommendedThemeId: Type.Optional(Type.String()),
  requiredCapabilities: Type.Array(Type.String()),
  metadata: Type.Object({ author: Type.Optional(Type.String()), version: Type.String(), license: Type.Optional(Type.String()), tags: Type.Array(Type.String()) }),
});

/** TPL — Template control API. One registry for all kinds. */
export const templateRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const templates = app.application.container.resolve<TemplateService>('templates');

  app.get(
    '/api/v2/templates',
    {
      schema: {
        tags: ['templates'],
        summary: 'List templates',
        response: { 200: Type.Array(TemplateSchema) },
      },
    },
    async (_request, reply) => reply.send(templates.list() as never),
  );

  app.get(
    '/api/v2/templates/kinds',
    {
      schema: {
        tags: ['templates'],
        summary: 'List template kinds',
        response: { 200: Type.Array(Type.String()) },
      },
    },
    async (_request, reply) => {
      const kinds = [...new Set(templates.list().map((t) => t.kind))].sort();
      return reply.send(kinds as never);
    },
  );

  app.get(
    '/api/v2/templates/:id',
    {
      schema: {
        tags: ['templates'],
        summary: 'Get a template',
        params: Type.Object({ id: Type.String() }),
        response: { 200: TemplateSchema },
      },
    },
    async (request, reply) => reply.send(templates.get(request.params.id) as never),
  );

  app.post(
    '/api/v2/templates',
    {
      schema: {
        tags: ['templates'],
        summary: 'Register a template (validated)',
        body: TemplateSchema,
        response: { 201: TemplateSchema },
      },
    },
    async (request, reply) => reply.status(201).send(templates.register(request.body as never) as never),
  );

  app.post(
    '/api/v2/templates/:id/instantiate',
    {
      schema: {
        tags: ['templates'],
        summary: 'Instantiate a template with parameters + context',
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({ values: Type.Record(Type.String(), Type.Any()), context: Type.Optional(Type.Record(Type.String(), Type.Any())) }),
        response: { 200: Type.Object({ template: TemplateSchema, definition: Type.Any() }) },
      },
    },
    async (request, reply) => {
      const result = templates.instantiate(request.params.id, request.body.values, request.body.context ?? {});
      return reply.send(result as never);
    },
  );

  app.delete(
    '/api/v2/templates/:id',
    {
      schema: {
        tags: ['templates'],
        summary: 'Remove a template',
        params: Type.Object({ id: Type.String() }),
        response: { 200: Type.Object({ deleted: Type.Boolean() }) },
      },
    },
    async (request, reply) => {
      templates.remove(request.params.id);
      return reply.send({ deleted: true } as never);
    },
  );
};
