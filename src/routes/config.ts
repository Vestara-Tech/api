import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { ConfigurationService } from '../configuration/service/configuration-service.js';

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

const ConfigurationKeySchema = Type.Object({
  namespace: Type.String(),
  key: Type.String(),
  name: Type.String(),
  secret: Type.Boolean(),
  defaultValue: Type.Optional(Type.Any()),
});

const ResolvedValueSchema = Type.Object({
  key: Type.String(),
  value: Type.Any(),
  scope: Type.String(),
  source: Type.String(),
  secret: Type.Boolean(),
});

const RevisionSchema = Type.Object({
  id: Type.String(),
  scope: Type.String(),
  values: Type.Record(Type.String(), Type.Any()),
  status: Type.String(),
  createdAt: Type.String(),
  appliedAt: Type.Optional(Type.String()),
  appliedBy: Type.Optional(Type.String()),
  note: Type.Optional(Type.String()),
});

const DraftSchema = Type.Object({
  id: Type.String(),
  scope: Type.String(),
  status: Type.String(),
  createdAt: Type.String(),
});

const ValidationSchema = Type.Object({
  ok: Type.Boolean(),
  issues: Type.Array(
    Type.Object({
      path: Type.String(),
      message: Type.String(),
      severity: Type.Union([Type.Literal('error'), Type.Literal('warning')]),
    }),
  ),
});

export const configRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const config = app.application.container.resolve<ConfigurationService>('configuration');

  app.get(
    '/api/v2/config/schemas',
    {
      schema: {
        tags: ['config'],
        summary: 'List registered configuration namespaces',
        response: {
          200: Type.Array(
            Type.Object({
              namespace: Type.String(),
              version: Type.String(),
              scope: Type.Array(Type.String()),
              secretFields: Type.Optional(Type.Array(Type.String())),
            }),
          ),
        },
      },
    },
    async (request, reply) => {
      const schemas = config.registry.list().map((d) => ({
        namespace: d.namespace,
        version: d.version,
        scope: d.scope,
        ...(d.secretFields !== undefined ? { secretFields: d.secretFields } : {}),
      }));
      return reply.send(schemas as never);
    },
  );

  app.get(
    '/api/v2/config/keys',
    {
      schema: {
        tags: ['config'],
        summary: 'List all configuration keys (leaf) with defaults',
        response: { 200: Type.Array(ConfigurationKeySchema) },
      },
    },
    async (_request, reply) => reply.send(config.keys() as never),
  );

  app.get(
    '/api/v2/config/resolved',
    {
      schema: {
        tags: ['config'],
        summary: 'Resolve all configuration values with their source scope',
        response: { 200: Type.Array(ResolvedValueSchema) },
      },
    },
    async (_request, reply) => reply.send(config.resolveAll() as never),
  );

  app.get(
    '/api/v2/config/resolved/:key',
    {
      schema: {
        tags: ['config'],
        summary: 'Resolve a single configuration key',
        params: Type.Object({ key: Type.String() }),
        response: { 200: ResolvedValueSchema, 404: ErrorSchema },
      },
    },
    async (request, reply) => {
      const resolved = config.resolve(request.params.key);
      if (!resolved) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: `Unknown key "${request.params.key}"`, requestId: request.ctx.requestId, correlationId: request.ctx.correlationId, retryable: false } });
      return reply.send(resolved);
    },
  );

  app.post(
    '/api/v2/config/drafts',
    {
      schema: {
        tags: ['config'],
        summary: 'Create a configuration draft (values per scope)',
        body: Type.Object({
          scope: Type.String(),
          values: Type.Record(Type.String(), Type.Any()),
          note: Type.Optional(Type.String()),
        }),
        response: { 201: DraftSchema },
      },
    },
    async (request, reply) => {
      const body = request.body;
      const revision = await config.draft({
        scope: body.scope,
        values: body.values,
        ...(body.note !== undefined ? { note: body.note } : {}),
      });
      return reply.status(201).send({ id: revision.id, scope: revision.scope, status: revision.status, createdAt: revision.createdAt });
    },
  );

  app.post(
    '/api/v2/config/drafts/:draftId/validate',
    {
      schema: {
        tags: ['config'],
        summary: 'Validate a configuration draft',
        params: Type.Object({ draftId: Type.String() }),
        response: { 200: ValidationSchema, 404: ErrorSchema },
      },
    },
    async (request, reply) => {
      const result = await config.validateDraft(request.params.draftId);
      return reply.send(result as never);
    },
  );

  app.post(
    '/api/v2/config/drafts/:draftId/apply',
    {
      schema: {
        tags: ['config'],
        summary: 'Apply a configuration draft (validated → active + events)',
        params: Type.Object({ draftId: Type.String() }),
        response: { 200: RevisionSchema, 400: ErrorSchema },
      },
    },
    async (request, reply) => {
      const revision = await config.apply(request.params.draftId, request.ctx.actorId);
      return reply.send(revision as never);
    },
  );

  app.get(
    '/api/v2/config/scopes/:scope/revisions',
    {
      schema: {
        tags: ['config'],
        summary: 'List revision history for a scope',
        params: Type.Object({ scope: Type.String() }),
        response: { 200: Type.Array(RevisionSchema) },
      },
    },
    async (request, reply) => reply.send((await config.revisions(request.params.scope)) as never),
  );

  app.post(
    '/api/v2/config/scopes/:scope/rollback',
    {
      schema: {
        tags: ['config'],
        summary: 'Roll back the applied configuration for a scope',
        params: Type.Object({ scope: Type.String() }),
        response: { 200: Type.Null(), 404: ErrorSchema },
      },
    },
    async (request, reply) => {
      const rolledBack = await config.rollback(request.params.scope, request.ctx.actorId);
      if (!rolledBack) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: `No applied revision for scope "${request.params.scope}"`, requestId: request.ctx.requestId, correlationId: request.ctx.correlationId, retryable: false } });
      return reply.send(null);
    },
  );
};
