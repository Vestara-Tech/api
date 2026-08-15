import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { FileService } from '../file/service/file-service.js';

const WorkspaceSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  root: Type.String(),
  providerId: Type.String(),
  include: Type.Optional(Type.Array(Type.String())),
  exclude: Type.Optional(Type.Array(Type.String())),
  revision: Type.Integer(),
});

const MountBodySchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  root: Type.String(),
  providerId: Type.String(),
  include: Type.Optional(Type.Array(Type.String())),
  exclude: Type.Optional(Type.Array(Type.String())),
});

const ResourceSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  path: Type.String(),
  kind: Type.String(),
  providerId: Type.String(),
  size: Type.Optional(Type.Integer()),
  hash: Type.Optional(Type.String()),
});

const OperationSchema = Type.Object({
  id: Type.Optional(Type.String()),
  kind: Type.Union([
    Type.Literal('create'),
    Type.Literal('update'),
    Type.Literal('append'),
    Type.Literal('rename'),
    Type.Literal('move'),
    Type.Literal('copy'),
    Type.Literal('delete'),
    Type.Literal('mkdir'),
  ]),
  path: Type.String(),
  content: Type.Optional(Type.String()),
  destination: Type.Optional(Type.String()),
});

const TransactionSchema = Type.Object({
  id: Type.String(),
  workspaceId: Type.String(),
  operations: Type.Array(Type.Object({ kind: Type.String(), path: Type.String() })),
  status: Type.String(),
  createdAt: Type.String(),
  error: Type.Optional(Type.String()),
});

const EventSchema = Type.Object({
  type: Type.String(),
  at: Type.String(),
  workspaceId: Type.Optional(Type.String()),
  path: Type.Optional(Type.String()),
});

const ApiErrorSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    requestId: Type.String(),
    correlationId: Type.String(),
    retryable: Type.Boolean(),
    details: Type.Optional(Type.Any()),
  }),
});

/**
 * FILE — File control API. Workspaces, read/list/search, governed
 * transactions (create/validate/preview/apply/rollback), versions, events.
 */
export const fileRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const file = app.application.file.service;

  app.get(
    '/api/v2/files/workspaces',
    {
      schema: {
        tags: ['files'],
        summary: 'List mounted file workspaces',
        response: { 200: Type.Array(WorkspaceSchema) },
      },
    },
    async (_request, reply) => reply.send(file.listWorkspaces() as never),
  );

  app.post(
    '/api/v2/files/workspaces',
    {
      schema: {
        tags: ['files'],
        summary: 'Mount a file workspace',
        body: MountBodySchema,
        response: { 201: WorkspaceSchema, 400: ApiErrorSchema },
      },
    },
    async (request, reply) => {
      const workspace = file.mountWorkspace({ ...request.body, revision: 1 });
      return reply.status(201).send(workspace as never);
    },
  );

  app.get(
    '/api/v2/files/workspaces/:workspaceId/read',
    {
      schema: {
        tags: ['files'],
        summary: 'Read a file',
        params: Type.Object({ workspaceId: Type.String() }),
        querystring: Type.Object({ path: Type.String() }),
        response: { 200: Type.Object({ content: Type.String(), resource: ResourceSchema }), 404: ApiErrorSchema },
      },
    },
    async (request, reply) => {
      const result = await file.read(request.params.workspaceId, request.query.path);
      return reply.send(result as never);
    },
  );

  app.get(
    '/api/v2/files/workspaces/:workspaceId/list',
    {
      schema: {
        tags: ['files'],
        summary: 'List a directory',
        params: Type.Object({ workspaceId: Type.String() }),
        querystring: Type.Object({ path: Type.String() }),
        response: { 200: Type.Array(ResourceSchema), 404: ApiErrorSchema },
      },
    },
    async (request, reply) => reply.send((await file.list(request.params.workspaceId, request.query.path)) as never),
  );

  app.get(
    '/api/v2/files/workspaces/:workspaceId/search',
    {
      schema: {
        tags: ['files'],
        summary: 'Search file names',
        params: Type.Object({ workspaceId: Type.String() }),
        querystring: Type.Object({ pattern: Type.String(), limit: Type.Optional(Type.String()) }),
        response: { 200: Type.Array(ResourceSchema) },
      },
    },
    async (request, reply) => {
      const limit = request.query.limit !== undefined ? Number(request.query.limit) : undefined;
      const results = await file.search(request.params.workspaceId, {
        pattern: request.query.pattern,
        ...(limit !== undefined ? { limit } : {}),
      });
      return reply.send(results as never);
    },
  );

  app.post(
    '/api/v2/files/transactions',
    {
      schema: {
        tags: ['files'],
        summary: 'Create a file transaction (draft)',
        body: Type.Object({ workspaceId: Type.String(), operations: Type.Array(OperationSchema) }),
        response: { 201: TransactionSchema, 400: ApiErrorSchema },
      },
    },
    async (request, reply) => {
      const transaction = file.createTransaction(request.body.workspaceId, request.body.operations as never);
      return reply.status(201).send(transaction as never);
    },
  );

  app.post(
    '/api/v2/files/transactions/:id/validate',
    {
      schema: {
        tags: ['files'],
        summary: 'Validate a file transaction against workspace policy',
        params: Type.Object({ id: Type.String() }),
        response: { 200: TransactionSchema, 400: ApiErrorSchema },
      },
    },
    async (request, reply) => reply.send(file.validateTransaction(request.params.id) as never),
  );

  app.post(
    '/api/v2/files/transactions/:id/preview',
    {
      schema: {
        tags: ['files'],
        summary: 'Preview a file transaction (diff)',
        params: Type.Object({ id: Type.String() }),
        response: { 200: TransactionSchema },
      },
    },
    async (request, reply) => reply.send(file.previewTransaction(request.params.id) as never),
  );

  app.post(
    '/api/v2/files/transactions/:id/apply',
    {
      schema: {
        tags: ['files'],
        summary: 'Apply a file transaction',
        params: Type.Object({ id: Type.String() }),
        response: { 200: TransactionSchema, 400: ApiErrorSchema },
      },
    },
    async (request, reply) => reply.send((await file.applyTransaction(request.params.id)) as never),
  );

  app.post(
    '/api/v2/files/transactions/:id/rollback',
    {
      schema: {
        tags: ['files'],
        summary: 'Roll back an applied file transaction',
        params: Type.Object({ id: Type.String() }),
        response: { 200: TransactionSchema, 400: ApiErrorSchema },
      },
    },
    async (request, reply) => reply.send((await file.rollbackTransaction(request.params.id)) as never),
  );

  app.get(
    '/api/v2/files/workspaces/:workspaceId/versions',
    {
      schema: {
        tags: ['files'],
        summary: 'List file version history',
        params: Type.Object({ workspaceId: Type.String() }),
        querystring: Type.Object({ path: Type.String() }),
        response: { 200: Type.Array(Type.Object({ revision: Type.Integer(), path: Type.String(), currentHash: Type.String(), timestamp: Type.String() })) },
      },
    },
    async (request, reply) => reply.send(file.versions(request.params.workspaceId, request.query.path) as never),
  );

  app.get(
    '/api/v2/files/events',
    {
      schema: {
        tags: ['files'],
        summary: 'List file events',
        response: { 200: Type.Array(EventSchema) },
      },
    },
    async (_request, reply) => reply.send(file.events() as never),
  );
};
