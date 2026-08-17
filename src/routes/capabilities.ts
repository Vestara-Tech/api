import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { CapabilityRegistry } from '../capabilities/registry.js';

const CapabilitySchema = Type.Object({
  id: Type.String(),
  namespace: Type.String(),
  version: Type.String(),
  permissions: Type.Array(Type.String()),
  operations: Type.Array(Type.String()),
  enabled: Type.Boolean(),
});

/** CAPABILITY — Capability discovery API for Admin shell navigation. */
export const capabilitiesRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const capabilities = app.application.container.resolve<CapabilityRegistry>('capabilities');

  app.get(
    '/api/v2/capabilities',
    {
      schema: {
        tags: ['capabilities'],
        summary: 'List registered capabilities',
        response: { 200: Type.Array(CapabilitySchema) },
      },
    },
    async (_request, reply) => reply.send(capabilities.list() as never),
  );

  app.get(
    '/api/v2/capabilities/enabled',
    {
      schema: {
        tags: ['capabilities'],
        summary: 'List enabled capability namespaces',
        response: { 200: Type.Array(Type.String()) },
      },
    },
    async (_request, reply) => reply.send(capabilities.listEnabled().map((capability) => capability.namespace) as never),
  );
};
