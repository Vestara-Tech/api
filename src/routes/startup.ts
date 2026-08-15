import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { StartupCoordinator } from '../startup/service/startup-coordinator.js';
import type { StartupStatus } from '../startup/domain/state.js';

const ErrorSchema = Type.Object({
  error: Type.Object({ code: Type.String(), message: Type.String(), requestId: Type.String(), correlationId: Type.String(), retryable: Type.Boolean(), details: Type.Optional(Type.Any()) }),
});

const ServiceStateSchema = Type.Object({
  serviceId: Type.String(),
  readiness: Type.String(),
  weight: Type.Integer(),
  updatedAt: Type.String(),
  detail: Type.Optional(Type.String()),
});

const StartupStateSchema = Type.Object({
  status: Type.String(),
  destination: Type.String(),
  firstBoot: Type.Boolean(),
  authenticated: Type.Boolean(),
  sessionReady: Type.Boolean(),
  readyAt: Type.Optional(Type.String()),
  failure: Type.Optional(Type.Object({ stage: Type.String(), message: Type.String(), at: Type.String() })),
});

export const startupRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const startup = app.application.container.resolve<StartupCoordinator>('startup');

  app.get(
    '/api/v2/startup',
    {
      schema: {
        tags: ['startup'],
        summary: 'Current startup snapshot (state + progress + services + classification)',
        response: { 200: Type.Object({ state: StartupStateSchema, progress: Type.Any(), services: Type.Array(ServiceStateSchema), classification: Type.Any() }) },
      },
    },
    async (_request, reply) => {
      const snapshot = startup.getSnapshot();
      return reply.send({
        state: snapshot.state,
        progress: snapshot.progress,
        services: snapshot.services,
        classification: snapshot.classification,
      } as never);
    },
  );

  app.get(
    '/api/v2/startup/state',
    {
      schema: {
        tags: ['startup'],
        summary: 'Startup state + routing destination',
        response: { 200: StartupStateSchema },
      },
    },
    async () => startup.stateValue(),
  );

  app.get(
    '/api/v2/startup/progress',
    {
      schema: {
        tags: ['startup'],
        summary: 'Startup progress aggregate',
        response: { 200: Type.Any() },
      },
    },
    async () => startup.getSnapshot().progress,
  );

  app.get(
    '/api/v2/startup/services',
    {
      schema: {
        tags: ['startup'],
        summary: 'Per-service readiness',
        response: { 200: Type.Array(ServiceStateSchema) },
      },
    },
    async (_request, reply) => reply.send(startup.getSnapshot().services as never),
  );

  app.post(
    '/api/v2/startup/transition',
    {
      schema: {
        tags: ['startup'],
        summary: 'Advance the startup state machine',
        body: Type.Object({ to: Type.String() }),
        response: { 200: StartupStateSchema, 400: ErrorSchema },
      },
    },
    async (request, reply) => {
      try {
        startup.transition(request.body.to as StartupStatus);
      } catch (err) {
        return reply.status(400).send({ error: { code: 'BAD_REQUEST', message: err instanceof Error ? err.message : 'invalid transition', requestId: request.ctx.requestId, correlationId: request.ctx.correlationId, retryable: false } });
      }
      return reply.send(startup.stateValue());
    },
  );

  app.post(
    '/api/v2/startup/services/:serviceId/readiness',
    {
      schema: {
        tags: ['startup'],
        summary: 'Update a service readiness (drives progress/classification)',
        params: Type.Object({ serviceId: Type.String() }),
        body: Type.Object({ readiness: Type.String(), detail: Type.Optional(Type.String()) }),
        response: { 200: ServiceStateSchema, 404: ErrorSchema },
      },
    },
    async (request, reply) => {
      const updated = startup.getSnapshot().services.find((s) => s.serviceId === request.params.serviceId);
      if (!updated) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: `Unknown service "${request.params.serviceId}"`, requestId: request.ctx.requestId, correlationId: request.ctx.correlationId, retryable: false } });
      const after = startup.getSnapshot().services.find((s) => s.serviceId === request.params.serviceId);
      startup.updateService(request.params.serviceId, request.body.readiness as never, request.body.detail);
      const latest = startup.getSnapshot().services.find((s) => s.serviceId === request.params.serviceId);
      return reply.send(latest ?? updated);
    },
  );
};
