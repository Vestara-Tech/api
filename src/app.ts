import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { TypeBoxValidatorCompiler } from '@fastify/type-provider-typebox';
import Fastify, { type FastifyServerOptions } from 'fastify';
import type { AppConfig } from './config/schema.js';
import type { Application } from './bootstrap/application.js';
import { registerRequestContextPlugin } from './plugins/request-context.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { registerTelemetry } from './plugins/telemetry.js';
import { registerCors } from './plugins/cors.js';
import { registerOpenApi } from './plugins/openapi.js';
import { healthRoutes } from './routes/health.js';
import { systemRoutes } from './routes/system.js';
import { builderRoutes } from './routes/builder.js';
import { authRoutes } from './routes/auth.js';
import { configRoutes } from './routes/config.js';
import { expandedConfigRoutes } from './routes/config-expanded.js';
import { generatorRoutes } from './routes/generator.js';
import { bootPresentationRoutes } from './routes/boot-presentation.js';
import { grubRoutes } from './routes/grub.js';
import { startupRoutes } from './routes/startup.js';
import { loginRoutes } from './routes/login.js';
import { imageBuilderRoutes } from './routes/image-builder.js';
import { aiRoutes } from './routes/ai.js';
import { aiExecuteRoutes } from './routes/ai-execute.js';
import { agentRoutes } from './routes/agents.js';
import { workflowRoutes } from './routes/workflow.js';
import { fileRoutes } from './routes/file.js';
import { contextRoutes } from './routes/context.js';
import { permissionRoutes } from './routes/permission.js';
import { carRoutes } from './routes/car.js';
import { marketplaceRoutes } from './routes/marketplace.js';
import { generationPlaneRoutes } from './routes/generation-plane.js';
import { builderPlaneRoutes } from './routes/builder-plane.js';
import { diagnosticsRoutes } from './routes/diagnostics.js';
import { logRoutes } from './routes/log.js';
import { databaseRoutes } from './routes/database.js';
import { testRoutes } from './routes/test.js';
import { browserRoutes } from './routes/browser.js';
import { taskRoutes } from './routes/task.js';
import { milestoneRoutes } from './routes/milestone.js';
import { componentRoutes } from './routes/component.js';
import { imagePlatformRoutes } from './routes/image-platform.js';
import { systemV2Routes } from './routes/system-v2.js';
import { osRoutes } from './routes/os.js';
import { pageBuilderRoutes } from './routes/page-builder.js';
import { applicationBuilderRoutes } from './routes/application-builder.js';
import { userRoutes } from './routes/user.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { themeRoutes } from './routes/theme.js';
import { templateRoutes } from './routes/template.js';
import { aiPlatformV2Routes } from './routes/ai-v2.js';
import { marketplaceV2Routes } from './routes/marketplace-v2.js';
import { onboardingV2Routes } from './routes/onboarding-v2.js';
import { capabilitiesRoutes } from './routes/capabilities.js';
import { registerAuthPlugin } from './auth/plugins/auth-plugin.js';

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
  await registerCors(app);

  registerAuthPlugin(app, {
    authentication: options.application.authentication,
    identities: options.application.container.resolve('auth.identityStore'),
  });

  await registerOpenApi(app, options.exposeDocs ?? true);
  await app.register(healthRoutes);
  await app.register(systemRoutes);
  await app.register(builderRoutes);
  await app.register(authRoutes);
  await app.register(configRoutes);
  await app.register(expandedConfigRoutes);
  await app.register(generatorRoutes);
  await app.register(bootPresentationRoutes);
  await app.register(grubRoutes);
  await app.register(startupRoutes);
  await app.register(loginRoutes);
  await app.register(imageBuilderRoutes);
  await app.register(aiRoutes);
  await app.register(aiExecuteRoutes);
  await app.register(agentRoutes);
  await app.register(workflowRoutes);
  await app.register(fileRoutes);
  await app.register(contextRoutes);
  await app.register(permissionRoutes);
  await app.register(carRoutes);
  await app.register(marketplaceRoutes);
  await app.register(generationPlaneRoutes);
  await app.register(builderPlaneRoutes);
  await app.register(diagnosticsRoutes);
  await app.register(logRoutes);
  await app.register(databaseRoutes);
  await app.register(testRoutes);
  await app.register(browserRoutes);
  await app.register(taskRoutes);
  await app.register(milestoneRoutes);
  await app.register(componentRoutes);
  await app.register(imagePlatformRoutes);
  await app.register(systemV2Routes);
  await app.register(osRoutes);
  await app.register(pageBuilderRoutes);
  await app.register(applicationBuilderRoutes);
  await app.register(userRoutes);
  await app.register(dashboardRoutes);
  await app.register(themeRoutes);
  await app.register(templateRoutes);
  await app.register(aiPlatformV2Routes);
  await app.register(marketplaceV2Routes);
  await app.register(onboardingV2Routes);
  await app.register(capabilitiesRoutes);

  app.log.info({ service: options.config.service, apiVersion: options.config.apiVersion }, 'application.boot');

  return app;
}
