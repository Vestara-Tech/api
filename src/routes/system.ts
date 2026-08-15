import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';

export const systemRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.get(
    '/api/v2',
    {
      schema: {
        tags: ['system'],
        summary: 'Service identity',
        response: {
          200: Type.Object({
            service: Type.String(),
            apiVersion: Type.String(),
            name: Type.String(),
          }),
        },
      },
    },
    async () => ({
      service: app.config.service,
      apiVersion: app.config.apiVersion,
      name: 'Vestara API v2',
    }),
  );

  app.get(
    '/api/v2/system',
    {
      schema: {
        tags: ['system'],
        summary: 'Platform system status',
        response: {
          200: Type.Object({
            service: Type.String(),
            apiVersion: Type.String(),
            uptimeMs: Type.Integer(),
            startedAt: Type.String(),
            capabilities: Type.Array(Type.String()),
          }),
        },
      },
    },
    async () => app.application.systemStatus(),
  );
};
