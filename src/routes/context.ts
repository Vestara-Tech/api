import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { ContextService } from '../context/service/context-service.js';

const CollectBodySchema = Type.Object({
  purpose: Type.Union([
    Type.Literal('agent-execution'),
    Type.Literal('workflow-step'),
    Type.Literal('retrieval'),
    Type.Literal('observation'),
    Type.Literal('debugging'),
  ]),
  principalId: Type.String(),
  scope: Type.Union([
    Type.Literal('system'),
    Type.Literal('organization'),
    Type.Literal('workspace'),
    Type.Literal('project'),
    Type.Literal('workflow'),
    Type.Literal('run'),
    Type.Literal('agent'),
    Type.Literal('task'),
    Type.Literal('turn'),
  ]),
  agentId: Type.Optional(Type.String()),
  workflowRunId: Type.Optional(Type.String()),
  task: Type.Optional(Type.String()),
  maxTokens: Type.Optional(Type.Integer()),
});

const BundleItemSchema = Type.Object({
  id: Type.String(),
  source: Type.String(),
  sourceId: Type.Optional(Type.String()),
  title: Type.Optional(Type.String()),
  content: Type.String(),
  priority: Type.Integer(),
  required: Type.Boolean(),
  sensitive: Type.Boolean(),
  tokenEstimate: Type.Optional(Type.Integer()),
});

const BundleSchema = Type.Object({
  id: Type.String(),
  purpose: Type.String(),
  items: Type.Array(BundleItemSchema),
  budget: Type.Object({
    maximumTokens: Type.Integer(),
    reservedOutputTokens: Type.Integer(),
    reservedSystemTokens: Type.Integer(),
    availableContextTokens: Type.Integer(),
  }),
  createdAt: Type.String(),
});

const SnapshotSchema = Type.Object({
  id: Type.String(),
  bundleHash: Type.String(),
  runId: Type.Optional(Type.String()),
  agentId: Type.Optional(Type.String()),
  workflowRunId: Type.Optional(Type.String()),
  items: Type.Array(Type.Object({ itemId: Type.String(), source: Type.String(), scope: Type.String(), tokenEstimate: Type.Integer() })),
  createdAt: Type.String(),
});

const ProviderViewSchema = Type.Object({
  id: Type.String(),
  kinds: Type.Array(Type.String()),
  scope: Type.String(),
});

/**
 * CTX-019 — Context control API. Collect bundles, snapshot them, list providers
 * and snapshots. Context can access a file ≠ an agent may see it: the collector
 * applies the authorization filter.
 */
export const contextRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const context = app.application.container.resolve<ContextService>('context');

  app.get(
    '/api/v2/context/providers',
    {
      schema: {
        tags: ['context'],
        summary: 'List context providers',
        response: { 200: Type.Array(ProviderViewSchema) },
      },
    },
    async (_request, reply) => reply.send(context.providers() as never),
  );

  app.post(
    '/api/v2/context/collect',
    {
      schema: {
        tags: ['context'],
        summary: 'Assemble a context bundle for an execution',
        body: CollectBodySchema,
        response: { 200: BundleSchema },
      },
    },
    async (request, reply) => {
      const bundle = await context.collect(request.body as never);
      return reply.send(bundle as never);
    },
  );

  app.post(
    '/api/v2/context/snapshots',
    {
      schema: {
        tags: ['context'],
        summary: 'Snapshot a context bundle',
        body: Type.Object({
          bundle: BundleSchema,
          runId: Type.Optional(Type.String()),
          agentId: Type.Optional(Type.String()),
          workflowRunId: Type.Optional(Type.String()),
        }),
        response: { 201: SnapshotSchema },
      },
    },
    async (request, reply) => {
      const snapshot = context.snapshot(request.body.bundle as never, {
        ...(request.body.runId !== undefined ? { runId: request.body.runId } : {}),
        ...(request.body.agentId !== undefined ? { agentId: request.body.agentId } : {}),
        ...(request.body.workflowRunId !== undefined ? { workflowRunId: request.body.workflowRunId } : {}),
      });
      return reply.status(201).send(snapshot as never);
    },
  );

  app.get(
    '/api/v2/context/snapshots',
    {
      schema: {
        tags: ['context'],
        summary: 'List context snapshots',
        response: { 200: Type.Array(SnapshotSchema) },
      },
    },
    async (_request, reply) => reply.send(context.listSnapshots() as never),
  );

  app.get(
    '/api/v2/context/snapshots/:id',
    {
      schema: {
        tags: ['context'],
        summary: 'Get a context snapshot',
        params: Type.Object({ id: Type.String() }),
        response: { 200: SnapshotSchema, 404: Type.Object({ error: Type.Object({ code: Type.String(), message: Type.String() }) }) },
      },
    },
    async (request, reply) => {
      const snapshot = context.getSnapshot(request.params.id);
      if (!snapshot) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: `Context snapshot "${request.params.id}" not found` } } as never);
      }
      return reply.send(snapshot as never);
    },
  );
};
