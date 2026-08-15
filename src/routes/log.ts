import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { LogService } from '../log/service/log-service.js';
import type { InMemoryLogStore } from '../log/store/in-memory.js';
import type { LogQuery } from '../log/contracts.js';

const RecordSchema = Type.Object({
  id: Type.String(),
  timestamp: Type.String(),
  level: Type.String(),
  message: Type.String(),
  source: Type.Object({ type: Type.String(), id: Type.String() }),
  correlationId: Type.Optional(Type.String()),
  workflowId: Type.Optional(Type.String()),
  agentId: Type.Optional(Type.String()),
  operationId: Type.Optional(Type.String()),
  attributes: Type.Record(Type.String(), Type.Any()),
});

const QueryBodySchema = Type.Object({
  level: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())])),
  sourceId: Type.Optional(Type.String()),
  sourceType: Type.Optional(Type.String()),
  correlationId: Type.Optional(Type.String()),
  workflowId: Type.Optional(Type.String()),
  agentId: Type.Optional(Type.String()),
  messageContains: Type.Optional(Type.String()),
  since: Type.Optional(Type.String()),
  until: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer()),
});

const EmitBodySchema = Type.Object({
  source: Type.Object({ type: Type.String(), id: Type.String() }),
  level: Type.Union([Type.Literal('trace'), Type.Literal('debug'), Type.Literal('info'), Type.Literal('warn'), Type.Literal('error'), Type.Literal('fatal')]),
  message: Type.String(),
  attributes: Type.Optional(Type.Record(Type.String(), Type.Any())),
});

/**
 * LOG-016 — Log control API. Query, tail, stats, sources, emit. Structured
 * records, never raw console output.
 */
export const logRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const service = app.application.container.resolve<LogService>('log.service');
  const store = app.application.container.resolve<InMemoryLogStore>('log.store');

  app.get(
    '/api/v2/logs',
    {
      schema: {
        tags: ['logs'],
        summary: 'Query logs',
        querystring: QueryBodySchema,
        response: { 200: Type.Array(RecordSchema) },
      },
    },
    async (request, reply) => reply.send(store.query(request.query as LogQuery) as never),
  );

  app.get(
    '/api/v2/logs/tail',
    {
      schema: {
        tags: ['logs'],
        summary: 'Tail recent logs',
        querystring: Type.Object({ limit: Type.Optional(Type.String()) }),
        response: { 200: Type.Array(RecordSchema) },
      },
    },
    async (request, reply) => {
      const limit = request.query.limit !== undefined ? Number(request.query.limit) : 50;
      return reply.send(store.tail(limit) as never);
    },
  );

  app.get(
    '/api/v2/logs/stats',
    {
      schema: {
        tags: ['logs'],
        summary: 'Log statistics',
        response: {
          200: Type.Object({
            total: Type.Integer(),
            byLevel: Type.Record(Type.String(), Type.Integer()),
            bySource: Type.Record(Type.String(), Type.Integer()),
          }),
        },
      },
    },
    async (_request, reply) => reply.send(store.aggregate({}) as never),
  );

  app.get(
    '/api/v2/logs/sources',
    {
      schema: {
        tags: ['logs'],
        summary: 'List log sources',
        response: { 200: Type.Array(Type.String()) },
      },
    },
    async (_request, reply) => reply.send(service.listSources() as never),
  );

  app.post(
    '/api/v2/logs/emit',
    {
      schema: {
        tags: ['logs'],
        summary: 'Emit a log record from a module/app (SDK ingestion)',
        body: EmitBodySchema,
        response: { 201: RecordSchema },
      },
    },
    async (request, reply) => {
      const record = service.emit(request.body.level, request.body.source as never, request.body.message, request.body.attributes);
      return reply.status(201).send(record as never);
    },
  );
};
