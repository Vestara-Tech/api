import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { GenerationPlane } from '../generation-plane/generation-plane.js';
import type { GenerationCapabilityRegistry } from '../generation-plane/capability-registry.js';

const IntentSchema = Type.Union([
  Type.Object({ kind: Type.Literal('api.endpoint'), target: Type.String(), operation: Type.String() }),
  Type.Object({ kind: Type.Literal('api.resource'), name: Type.String() }),
  Type.Object({ kind: Type.Literal('agent.definition'), role: Type.String(), objective: Type.String() }),
  Type.Object({ kind: Type.Literal('workflow.definition'), name: Type.String(), stages: Type.Array(Type.String()) }),
  Type.Object({ kind: Type.Literal('database.schema'), table: Type.String(), fields: Type.Array(Type.String()) }),
  Type.Object({ kind: Type.Literal('integration.adapter'), provider: Type.String() }),
  Type.Object({ kind: Type.Literal('configuration.draft'), scope: Type.String() }),
  Type.Object({ kind: Type.Literal('os.profile'), profileId: Type.String() }),
  Type.Object({ kind: Type.Literal('package.manifest'), packageId: Type.String() }),
  Type.Object({ kind: Type.Literal('test.api'), resource: Type.String(), operations: Type.Array(Type.String()) }),
]);

/**
 * GEN-X — Generation plane control API. Capability discovery + intent
 * resolution. Deterministic infrastructure owns execution; AI only proposes.
 */
export const generationPlaneRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const plane = app.application.container.resolve<GenerationPlane>('generation.plane');
  const registry = app.application.container.resolve<GenerationCapabilityRegistry>('generation.registry');

  app.get(
    '/api/v2/generation/capabilities',
    {
      schema: {
        tags: ['generation'],
        summary: 'List generation capabilities',
        response: { 200: Type.Array(Type.String()) },
      },
    },
    async (_request, reply) => reply.send(plane.listCapabilities() as never),
  );

  app.get(
    '/api/v2/generation/contributions',
    {
      schema: {
        tags: ['generation'],
        summary: 'List generator contributions',
        response: {
          200: Type.Array(
            Type.Object({
              id: Type.String(),
              moduleId: Type.String(),
              category: Type.String(),
              capabilities: Type.Array(Type.String()),
              permissions: Type.Array(Type.String()),
            }),
          ),
        },
      },
    },
    async (_request, reply) =>
      reply.send(
        registry.listContributions().map((c) => ({ id: c.id, moduleId: c.moduleId, category: c.category, capabilities: c.capabilities, permissions: c.permissions })) as never,
      ),
  );

  app.post(
    '/api/v2/generation/resolve',
    {
      schema: {
        tags: ['generation'],
        summary: 'Resolve a generation capability to a generator',
        body: Type.Object({ capability: Type.String() }),
        response: {
          200: Type.Object({ generatorId: Type.String(), moduleId: Type.String(), version: Type.String() }),
          404: Type.Object({ error: Type.Object({ code: Type.String(), message: Type.String() }) }),
        },
      },
    },
    async (request, reply) => {
      try {
        const resolved = plane.resolveGenerator(request.body.capability);
        return reply.send(resolved as never);
      } catch (err) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: (err as Error).message } } as never);
      }
    },
  );

  app.post(
    '/api/v2/generation/intent/capability',
    {
      schema: {
        tags: ['generation'],
        summary: 'Map a typed generation intent to a capability',
        body: IntentSchema,
        response: { 200: Type.Object({ capability: Type.String() }) },
      },
    },
    async (request, reply) => reply.send({ capability: plane.intentToCapability(request.body as never) } as never),
  );
};
