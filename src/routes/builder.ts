import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { ApiDefinitionStatus } from '../builder/domain/types.js';
import {
  ApiDefinitionSchema,
  CompatibilitySchema,
  ContractSchema,
  CreateDefinitionBody,
  ErrorSchema,
  ListQuerySchema,
  ListDefinitionsResultSchema,
  PreviewResultSchema,
  PublishResultSchema,
  RevisionSchema,
  UpdateDefinitionBody,
  ValidationResultSchema,
} from '../builder/contracts.js';

export const builderRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const builder = app.application.builder;

  app.get(
    '/api/v2/builder/definitions',
    {
      schema: {
        tags: ['builder'],
        summary: 'List API definitions',
        querystring: ListQuerySchema,
        response: {
          200: ListDefinitionsResultSchema,
        },
      },
    },
    async (request, reply) => {
      const q = request.query;
      const limit = q.limit !== undefined ? Number(q.limit) : undefined;
      const result = await builder.list({
        ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
        ...(limit !== undefined ? { limit } : {}),
        ...(q.status !== undefined ? { status: q.status as ApiDefinitionStatus } : {}),
        ...(q.search !== undefined ? { search: q.search } : {}),
        ...(q.sort !== undefined ? { sort: q.sort as 'createdAt' | 'updatedAt' | 'name' } : {}),
      });
      return reply.send(result as never);
    },
  );

  app.post(
    '/api/v2/builder/definitions',
    {
      schema: {
        tags: ['builder'],
        summary: 'Create an API definition',
        body: CreateDefinitionBody,
        response: { 201: ApiDefinitionSchema },
      },
    },
    async (request, reply) => {
      const body = request.body;
      const definition = await builder.create({
        name: body.name,
        namespace: body.namespace,
        version: body.version,
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
        ...(body.author !== undefined ? { author: body.author } : {}),
      });
      return reply.status(201).send(definition as never);
    },
  );

  app.get(
    '/api/v2/builder/definitions/:id',
    {
      schema: {
        tags: ['builder'],
        summary: 'Get an API definition',
        params: Type.Object({ id: Type.String() }),
        response: { 200: ApiDefinitionSchema, 404: ErrorSchema },
      },
    },
    async (request, reply) => {
      const definition = await builder.get(request.params.id);
      return reply.send(definition as never);
    },
  );

  app.patch(
    '/api/v2/builder/definitions/:id',
    {
      schema: {
        tags: ['builder'],
        summary: 'Update an API definition (If-Match: "revision-N")',
        params: Type.Object({ id: Type.String() }),
        body: UpdateDefinitionBody,
        headers: Type.Object({ 'if-match': Type.Optional(Type.String()) }),
        response: { 200: ApiDefinitionSchema, 404: ErrorSchema, 409: ErrorSchema },
      },
    },
    async (request, reply) => {
      const expected = parseIfMatch(request.headers['if-match']);
      const definition = await builder.update(request.params.id, request.body as never, expected);
      return reply.send(definition as never);
    },
  );

  app.delete(
    '/api/v2/builder/definitions/:id',
    {
      schema: {
        tags: ['builder'],
        summary: 'Delete an API definition',
        params: Type.Object({ id: Type.String() }),
        headers: Type.Object({ 'if-match': Type.Optional(Type.String()) }),
        response: { 204: Type.Null(), 404: ErrorSchema, 409: ErrorSchema },
      },
    },
    async (request, reply) => {
      const expected = parseIfMatch(request.headers['if-match']);
      await builder.remove(request.params.id, expected);
      return reply.status(204).send(null);
    },
  );

  app.post(
    '/api/v2/builder/definitions/:id/validate',
    {
      schema: {
        tags: ['builder'],
        summary: 'Validate an API definition',
        params: Type.Object({ id: Type.String() }),
        response: { 200: ValidationResultSchema, 404: ErrorSchema },
      },
    },
    async (request, reply) => {
      const result = await builder.validate(request.params.id);
      return reply.send(result as never);
    },
  );

  app.post(
    '/api/v2/builder/definitions/:id/preview',
    {
      schema: {
        tags: ['builder'],
        summary: 'Preview an API definition (validation + contract + compatibility)',
        params: Type.Object({ id: Type.String() }),
        response: { 200: PreviewResultSchema, 404: ErrorSchema },
      },
    },
    async (request, reply) => {
      const preview = await builder.preview(request.params.id);
      return reply.send(preview as never);
    },
  );

  app.post(
    '/api/v2/builder/definitions/:id/publish',
    {
      schema: {
        tags: ['builder'],
        summary: 'Publish an API definition',
        params: Type.Object({ id: Type.String() }),
        headers: Type.Object({ 'if-match': Type.Optional(Type.String()) }),
        response: {
          200: PublishResultSchema,
          404: ErrorSchema,
          409: ErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const expected = parseIfMatch(request.headers['if-match']);
      const result = await builder.publish(request.params.id, request.ctx, expected);
      return reply.send(result as never);
    },
  );

  app.get(
    '/api/v2/builder/definitions/:id/revisions',
    {
      schema: {
        tags: ['builder'],
        summary: 'List published revisions',
        params: Type.Object({ id: Type.String() }),
        response: { 200: Type.Array(RevisionSchema), 404: ErrorSchema },
      },
    },
    async (request, reply) => {
      const revisions = await builder.revisions(request.params.id);
      return reply.send(revisions as never);
    },
  );

  app.get(
    '/api/v2/builder/definitions/:id/revisions/:revision',
    {
      schema: {
        tags: ['builder'],
        summary: 'Get a specific published revision',
        params: Type.Object({ id: Type.String(), revision: Type.String() }),
        response: { 200: RevisionSchema, 404: ErrorSchema },
      },
    },
    async (request, reply) => {
      const revision = Number.parseInt(request.params.revision, 10);
      const found = await builder.revision(request.params.id, revision);
      return reply.send(found as never);
    },
  );

  app.post(
    '/api/v2/builder/definitions/:id/rollback',
    {
      schema: {
        tags: ['builder'],
        summary: 'Roll back to the previous published revision',
        params: Type.Object({ id: Type.String() }),
        response: { 200: ApiDefinitionSchema, 404: ErrorSchema },
      },
    },
    async (request, reply) => {
      const definition = await builder.rollback(request.params.id);
      return reply.send(definition as never);
    },
  );
};

function parseIfMatch(header: string | undefined): number | undefined {
  if (header === undefined) return undefined;
  const match = header.match(/^"?revision-(\d+)"?$/);
  return match ? Number.parseInt(match[1]!, 10) : undefined;
}
