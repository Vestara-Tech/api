import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { TypeBoxValidatorCompiler } from '@fastify/type-provider-typebox';
import Fastify, { type FastifyServerOptions } from 'fastify';
import type { AppConfig } from './config/schema.js';
import type { Application } from './bootstrap/application.js';
import { registerRequestContextPlugin } from './plugins/request-context.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { registerTelemetry } from './plugins/telemetry.js';
import { registerOpenApi } from './plugins/openapi.js';
import { healthRoutes } from './routes/health.js';
import { systemRoutes } from './routes/system.js';
import { builderRoutes } from './routes/builder.js';

export interface BuildAppOptions {
  readonly config: AppConfig;
  readonly application: Application;
  readonly exposeDocs?: boolean;
}

export type VestaraFastifyInstance = ReturnType<typeof buildApp>;

export async function buildApp(options: BuildAppOptions) {
  const fastifyOptions: FastifyServerOptions = {
    logger: {
      level: options.config.logLevel,
      base: { service: options.config.service },
    },
    disableRequestLogging: true,
  };

  const app = Fastify(fastifyOptions)
    .setValidatorCompiler(TypeBoxValidatorCompiler)
    .withTypeProvider<TypeBoxTypeProvider>();

  app.decorate('config', options.config);
  app.decorate('application', options.application);

  registerRequestContextPlugin(app);
  registerErrorHandler(app);
  registerTelemetry(app);

  await registerOpenApi(app, options.exposeDocs ?? true);
  await app.register(healthRoutes);
  await app.register(systemRoutes);
  await app.register(builderRoutes);

  app.log.info({ service: options.config.service, apiVersion: options.config.apiVersion }, 'application.boot');

  return app;
}
