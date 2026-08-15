import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { ApiDefinitionStatus, ApiHttpMethod } from '../builder/domain/types.js';

const ApiFieldSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  type: Type.String(),
  required: Type.Optional(Type.Boolean()),
  unique: Type.Optional(Type.Boolean()),
  indexed: Type.Optional(Type.Boolean()),
  enumValues: Type.Optional(Type.Array(Type.String())),
});

const ApiResourceSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  plural: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  fields: Type.Array(ApiFieldSchema),
});

const ApiEndpointParameterSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  in: Type.Union([Type.Literal('path'), Type.Literal('query'), Type.Literal('header'), Type.Literal('cookie')]),
  type: Type.String(),
  required: Type.Optional(Type.Boolean()),
});

const ApiEndpointResponseSchema = Type.Object({
  status: Type.Integer(),
  description: Type.Optional(Type.String()),
  resource: Type.Optional(Type.String()),
});

const ApiEndpointSchema = Type.Object({
  id: Type.String(),
  method: Type.Union([Type.Literal('GET'), Type.Literal('POST'), Type.Literal('PUT'), Type.Literal('PATCH'), Type.Literal('DELETE')]),
  path: Type.String(),
  summary: Type.Optional(Type.String()),
  parameters: Type.Optional(Type.Array(ApiEndpointParameterSchema)),
  requestBody: Type.Optional(Type.Object({ resource: Type.Optional(Type.String()) })),
  responses: Type.Optional(Type.Array(ApiEndpointResponseSchema)),
  policyIds: Type.Optional(Type.Array(Type.String())),
  capabilityBinding: Type.Optional(Type.String()),
});

const ApiPolicySchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  effect: Type.Union([Type.Literal('allow'), Type.Literal('deny')]),
  action: Type.String(),
  resource: Type.Optional(Type.String()),
});

const ApiOperationSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  kind: Type.String(),
});

const ApiEventSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
});

const ApiDefinitionSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  namespace: Type.String(),
  version: Type.String(),
  status: Type.String(),
  resources: Type.Array(ApiResourceSchema),
  endpoints: Type.Array(ApiEndpointSchema),
  policies: Type.Array(ApiPolicySchema),
  operations: Type.Array(ApiOperationSchema),
  events: Type.Array(ApiEventSchema),
  revision: Type.Integer(),
  metadata: Type.Object({
    description: Type.Optional(Type.String()),
    tags: Type.Optional(Type.Array(Type.String())),
    author: Type.Optional(Type.String()),
    createdAt: Type.String(),
    updatedAt: Type.String(),
  }),
});

const CreateDefinitionBody = Type.Object({
  name: Type.String(),
  namespace: Type.String(),
  version: Type.String(),
  description: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  author: Type.Optional(Type.String()),
});

const UpdateDefinitionBody = Type.Object({
  name: Type.Optional(Type.String()),
  namespace: Type.Optional(Type.String()),
  version: Type.Optional(Type.String()),
  resources: Type.Optional(Type.Array(ApiResourceSchema)),
  endpoints: Type.Optional(Type.Array(ApiEndpointSchema)),
  policies: Type.Optional(Type.Array(ApiPolicySchema)),
  operations: Type.Optional(Type.Array(ApiOperationSchema)),
  events: Type.Optional(Type.Array(ApiEventSchema)),
});

const ValidationResultSchema = Type.Object({
  ok: Type.Boolean(),
  issues: Type.Array(
    Type.Object({
      path: Type.String(),
      message: Type.String(),
      severity: Type.Union([Type.Literal('error'), Type.Literal('warning')]),
    }),
  ),
});

const ContractSchema = Type.Object({
  hash: Type.String(),
  compilerVersion: Type.String(),
  openapi: Type.Any(),
  routes: Type.Array(Type.Any()),
});

const PreviewResultSchema = Type.Object({
  definition: ApiDefinitionSchema,
  validation: ValidationResultSchema,
  contract: ContractSchema,
  compatibility: Type.Object({
    classification: Type.Union([Type.Literal('compatible'), Type.Literal('breaking'), Type.Literal('unknown')]),
    changes: Type.Array(
      Type.Object({
        kind: Type.String(),
        path: Type.String(),
        severity: Type.Union([Type.Literal('breaking'), Type.Literal('compatible'), Type.Literal('info')]),
        message: Type.String(),
      }),
    ),
  }),
  publishable: Type.Boolean(),
});

const RevisionSchema = Type.Object({
  definition: ApiDefinitionSchema,
  compiledHash: Type.String(),
  recordedAt: Type.String(),
});

const ListQuery = Type.Object({
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Union([Type.Integer(), Type.String()])),
  status: Type.Optional(Type.String()),
  search: Type.Optional(Type.String()),
  sort: Type.Optional(Type.String()),
});

const ErrorSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    requestId: Type.String(),
    correlationId: Type.String(),
    retryable: Type.Boolean(),
    details: Type.Optional(Type.Any()),
  }),
});

export const builderRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const builder = app.application.builder;

  app.get(
    '/api/v2/builder/definitions',
    {
      schema: {
        tags: ['builder'],
        summary: 'List API definitions',
        querystring: ListQuery,
        response: {
          200: Type.Object({
            items: Type.Array(ApiDefinitionSchema),
            nextCursor: Type.Union([Type.String(), Type.Null()]),
            total: Type.Integer(),
          }),
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
          200: Type.Object({ definition: ApiDefinitionSchema, operationId: Type.String() }),
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
