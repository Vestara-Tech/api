import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';

export const healthRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.get(
    '/health/live',
    {
      schema: {
        tags: ['system'],
        summary: 'Liveness probe',
        response: {
          200: Type.Object({
            status: Type.Literal('live'),
            service: Type.String(),
          }),
        },
      },
    },
    async (): Promise<{ status: 'live'; service: string }> => ({ status: 'live', service: app.config.service }),
  );

  app.get(
    '/health/ready',
    {
      schema: {
        tags: ['system'],
        summary: 'Readiness probe',
        response: {
          200: Type.Object({
            status: Type.Literal('ready'),
            service: Type.String(),
          }),
          503: Type.Object({
            status: Type.String(),
            service: Type.String(),
          }),
        },
      },
    },
    async (): Promise<{ status: 'ready'; service: string }> => ({ status: 'ready', service: app.config.service }),
  );
};
