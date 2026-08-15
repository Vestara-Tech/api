import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { ExpandedConfigurationService } from '../configuration/service/expanded-service.js';

const FieldSchema = Type.Object({
  key: Type.String(),
  title: Type.String(),
  type: Type.String(),
  required: Type.Optional(Type.Boolean()),
  secret: Type.Optional(Type.Boolean()),
  reloadBehavior: Type.String(),
  risk: Type.String(),
});

const ContributionSchema = Type.Object({
  packageId: Type.String(),
  namespace: Type.String(),
  version: Type.String(),
  fields: Type.Array(FieldSchema),
});

const TransactionBodySchema = Type.Object({
  scope: Type.Object({ type: Type.String() }),
  changes: Type.Array(Type.Object({ key: Type.String(), from: Type.Any(), to: Type.Any() })),
});

const ImpactBodySchema = Type.Object({
  changes: Type.Array(Type.Object({ key: Type.String(), from: Type.Any(), to: Type.Any() })),
});

/**
 * CONFIG-021 — expanded Configuration control API. Contributions, fields,
 * provenance, impact, transactions. The configuration control plane for all
 * packages.
 */
export const expandedConfigRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const expanded = app.application.container.resolve<ExpandedConfigurationService>('config.expanded');

  app.get(
    '/api/v2/config/contributions',
    {
      schema: {
        tags: ['config'],
        summary: 'List configuration contributions (packages)',
        response: { 200: Type.Array(ContributionSchema) },
      },
    },
    async (_request, reply) =>
      reply.send(
        expanded.listContributions().map((c) => ({ packageId: c.packageId, namespace: c.namespace, version: c.version, fields: c.fields.map((f) => ({ key: f.key, title: f.title, type: f.type, ...(f.required !== undefined ? { required: f.required } : {}), ...(f.secret !== undefined ? { secret: f.secret } : {}), reloadBehavior: f.reloadBehavior, risk: f.risk })) })) as never,
      ),
  );

  app.get(
    '/api/v2/config/fields',
    {
      schema: {
        tags: ['config'],
        summary: 'List configuration fields with operational metadata',
        response: { 200: Type.Array(FieldSchema) },
      },
    },
    async (_request, reply) =>
      reply.send(
        expanded.listFields().map((f) => ({ key: f.key, title: f.title, type: f.type, ...(f.required !== undefined ? { required: f.required } : {}), ...(f.secret !== undefined ? { secret: f.secret } : {}), reloadBehavior: f.reloadBehavior, risk: f.risk })) as never,
      ),
  );

  app.get(
    '/api/v2/config/fields/:key',
    {
      schema: {
        tags: ['config'],
        summary: 'Get a configuration field definition',
        params: Type.Object({ key: Type.String() }),
        response: { 200: FieldSchema },
      },
    },
    async (request, reply) => {
      const f = expanded.getField(request.params.key);
      return reply.send({ key: f.key, title: f.title, type: f.type, ...(f.required !== undefined ? { required: f.required } : {}), ...(f.secret !== undefined ? { secret: f.secret } : {}), reloadBehavior: f.reloadBehavior, risk: f.risk } as never);
    },
  );

  app.post(
    '/api/v2/config/impact',
    {
      schema: {
        tags: ['config'],
        summary: 'Analyze the operational impact of configuration changes',
        body: ImpactBodySchema,
        response: {
          200: Type.Object({
            affectedModules: Type.Array(Type.String()),
            affectedServices: Type.Array(Type.String()),
            requiredRestarts: Type.Array(Type.String()),
            requiresRegeneration: Type.Array(Type.String()),
            requiresReboot: Type.Boolean(),
            risk: Type.String(),
            summary: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => reply.send(expanded.analyzeImpact(request.body.changes) as never),
  );

  app.post(
    '/api/v2/config/transactions',
    {
      schema: {
        tags: ['config'],
        summary: 'Create an atomic configuration transaction',
        body: TransactionBodySchema,
        response: {
          201: Type.Object({ id: Type.String(), scope: Type.Object({ type: Type.String() }), changes: Type.Array(Type.Object({ key: Type.String() })), status: Type.String(), createdAt: Type.String() }),
        },
      },
    },
    async (request, reply) => reply.status(201).send(expanded.createTransaction(request.body.scope as never, request.body.changes) as never),
  );

  app.get(
    '/api/v2/config/transactions',
    {
      schema: {
        tags: ['config'],
        summary: 'List configuration transactions',
        response: {
          200: Type.Array(Type.Object({ id: Type.String(), scope: Type.Object({ type: Type.String() }), status: Type.String(), createdAt: Type.String() })),
        },
      },
    },
    async (_request, reply) => reply.send(expanded.listTransactions() as never),
  );
};
