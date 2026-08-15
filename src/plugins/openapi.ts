import type { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifyScalarUi from '@scalar/fastify-api-reference';
import { API_VERSION, SERVICE_NAME } from '../config/defaults.js';

export async function registerOpenApi(app: FastifyInstance, exposeDocs: boolean): Promise<void> {
  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Vestara API v2',
        description: 'Vestara Platform Gateway and Control Plane.',
        version: '2.0.0-alpha.1',
      },
      servers: [{ url: 'http://127.0.0.1:4310' }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
    hideUntagged: true,
  });

  if (exposeDocs) {
    await app.register(fastifyScalarUi, {
      routePrefix: '/docs',
      configuration: {
        title: 'Vestara API v2',
        theme: 'purple',
      },
    });
  }

  app.log.info(
    {
      service: SERVICE_NAME,
      apiVersion: API_VERSION,
      exposeDocs,
    },
    'openapi.registered',
  );
}
