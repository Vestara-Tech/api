import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { DatabaseService } from '../database/service/database-service.js';

const DefinitionViewSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  engine: Type.String(),
  tables: Type.Array(Type.Object({ id: Type.String(), name: Type.String(), columns: Type.Array(Type.Object({ id: Type.String(), name: Type.String(), type: Type.String() })) })),
  revision: Type.Integer(),
  status: Type.String(),
});

const CreateDefinitionBodySchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  engine: Type.String(),
  tables: Type.Optional(Type.Array(Type.Object({ id: Type.String(), name: Type.String(), columns: Type.Array(Type.Object({ id: Type.String(), name: Type.String(), type: Type.String(), nullable: Type.Boolean() })) }))),
});

const MigrationPlanBodySchema = Type.Object({
  target: Type.Object({
    id: Type.String(),
    name: Type.String(),
    engine: Type.String(),
    tables: Type.Array(Type.Object({ id: Type.String(), name: Type.String(), columns: Type.Array(Type.Object({ id: Type.String(), name: Type.String(), type: Type.String() })) })),
  }),
});

const ConnectionSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  engine: Type.String(),
  host: Type.String(),
  database: Type.String(),
  credentialRef: Type.String(),
  status: Type.String(),
});

/**
 * DB-021 — Database control API. Definitions, migration planning, connections
 * (password = credentialRef only; never resolved values). PostgreSQL becomes
 * the reference adapter next.
 */
export const databaseRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const database = app.application.container.resolve<DatabaseService>('database');

  app.get(
    '/api/v2/database/definitions',
    {
      schema: {
        tags: ['database'],
        summary: 'List database definitions',
        response: { 200: Type.Array(DefinitionViewSchema) },
      },
    },
    async (_request, reply) => reply.send(database.listDefinitions() as never),
  );

  app.post(
    '/api/v2/database/definitions',
    {
      schema: {
        tags: ['database'],
        summary: 'Create a database definition',
        body: CreateDefinitionBodySchema,
        response: { 201: DefinitionViewSchema },
      },
    },
    async (request, reply) => {
      const definition = database.createDefinition(request.body as never);
      return reply.status(201).send(definition as never);
    },
  );

  app.get(
    '/api/v2/database/definitions/:id',
    {
      schema: {
        tags: ['database'],
        summary: 'Get a database definition',
        params: Type.Object({ id: Type.String() }),
        response: { 200: DefinitionViewSchema },
      },
    },
    async (request, reply) => reply.send(database.getDefinition(request.params.id) as never),
  );

  app.post(
    '/api/v2/database/definitions/:id/migration/plan',
    {
      schema: {
        tags: ['database'],
        summary: 'Plan a migration against the current definition (risk + destructive)',
        params: Type.Object({ id: Type.String() }),
        body: MigrationPlanBodySchema,
        response: {
          200: Type.Object({
            operations: Type.Array(Type.Object({ kind: Type.String(), table: Type.String(), column: Type.Optional(Type.String()) })),
            destructive: Type.Boolean(),
            risk: Type.String(),
            summary: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => reply.send(database.planMigration(request.params.id, request.body.target as never) as never),
  );

  app.get(
    '/api/v2/database/connections',
    {
      schema: {
        tags: ['database'],
        summary: 'List database connections (credential refs, never passwords)',
        response: { 200: Type.Array(ConnectionSchema) },
      },
    },
    async (_request, reply) => reply.send(database.listConnections() as never),
  );
};
