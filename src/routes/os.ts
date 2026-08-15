import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { OsService } from '../os/service/os-service.js';

const DiffEntrySchema = Type.Object({
  category: Type.String(),
  key: Type.String(),
  from: Type.Optional(Type.Any()),
  to: Type.Optional(Type.Any()),
});

const ChangeSchema = Type.Object({
  id: Type.String(),
  kind: Type.String(),
  category: Type.String(),
  target: Type.String(),
  from: Type.Optional(Type.Any()),
  to: Type.Optional(Type.Any()),
  risk: Type.String(),
  requiresReboot: Type.Boolean(),
  requiresApproval: Type.Boolean(),
  requiresSystemCapability: Type.Optional(Type.String()),
});

const PlanSchema = Type.Object({
  planId: Type.String(),
  changes: Type.Array(ChangeSchema),
  order: Type.Array(Type.String()),
  totalRisk: Type.String(),
  requiresApproval: Type.Boolean(),
  requiresReboot: Type.Boolean(),
  planHash: Type.String(),
  generatedAt: Type.String(),
});

const ProfileSchema = Type.Object({
  identity: Type.Object({ hostname: Type.String(), distributionId: Type.String(), kernelRelease: Type.String(), architecture: Type.String() }),
  distribution: Type.Object({ id: Type.String(), packageManager: Type.String() }),
  kernel: Type.Object({ release: Type.String(), parameters: Type.Array(Type.String()), updatePolicy: Type.String() }),
  packages: Type.Object({ packages: Type.Array(Type.Object({ name: Type.String(), state: Type.String() })), repositories: Type.Array(Type.Any()) }),
  services: Type.Object({ services: Type.Array(Type.Any()) }),
  users: Type.Array(Type.Any()),
  startup: Type.Object({ target: Type.String(), timeoutSeconds: Type.Integer(), failurePolicy: Type.String() }),
  login: Type.Object({ provider: Type.String(), allowAutoLogin: Type.Boolean() }),
  desktop: Type.Object({ environment: Type.String(), theme: Type.String() }),
  network: Type.Object({ hostname: Type.String(), interfaces: Type.Array(Type.Any()) }),
  locale: Type.Object({ language: Type.String(), locale: Type.String(), timezone: Type.String() }),
  security: Type.Object({ lockdown: Type.String() }),
  updates: Type.Object({ channel: Type.String(), automatic: Type.Boolean(), rebootPolicy: Type.String() }),
  recovery: Type.Object({ enabled: Type.Boolean() }),
});

const StateModelSchema = Type.Object({
  current: Type.Object({ profile: ProfileSchema, capturedAt: Type.String() }),
  desired: Type.Object({ profile: ProfileSchema, revision: Type.Integer(), updatedAt: Type.String() }),
  driftCount: Type.Integer(),
});

/**
 * OS-038 — OS control API. Inspect current state, declare desired state,
 * compute the diff and compile the change plan. Plans, not mutations: apply
 * requires approval and delegates privileged writes to the System Module.
 */
export const osRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const os = app.application.container.resolve<OsService>('os');

  app.get(
    '/api/v2/os/current',
    {
      schema: {
        tags: ['os'],
        summary: 'Current OS profile (captured)',
        response: { 200: Type.Object({ profile: ProfileSchema, lifecycle: Type.Object({ state: Type.String(), since: Type.String() }), capturedAt: Type.String() }) },
      },
    },
    async (_request, reply) => reply.send((await os.current()) as never),
  );

  app.get(
    '/api/v2/os/desired',
    {
      schema: {
        tags: ['os'],
        summary: 'Declared desired OS profile',
        response: {
          200: Type.Object({ profile: ProfileSchema, revision: Type.Integer(), updatedAt: Type.String() }),
          404: Type.Object({ error: Type.Object({ code: Type.String(), message: Type.String() }) }),
        },
      },
    },
    async (_request, reply) => {
      const desired = os.getDesired();
      if (!desired) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'No desired OS profile declared' } } as never);
      return reply.send(desired as never);
    },
  );

  app.put(
    '/api/v2/os/desired',
    {
      schema: {
        tags: ['os'],
        summary: 'Declare the desired OS profile (revisioned)',
        body: ProfileSchema,
        response: { 200: Type.Object({ profile: ProfileSchema, revision: Type.Integer(), updatedAt: Type.String() }) },
      },
    },
    async (request, reply) => reply.send(os.setDesired(request.body as never) as never),
  );

  app.get(
    '/api/v2/os/state',
    {
      schema: {
        tags: ['os'],
        summary: 'Current + desired OS state model with drift count',
        response: { 200: StateModelSchema },
      },
    },
    async (_request, reply) => reply.send((await os.stateModel()) as never),
  );

  app.get(
    '/api/v2/os/diff',
    {
      schema: {
        tags: ['os'],
        summary: 'OS diff between current and desired',
        response: { 200: Type.Object({ entries: Type.Array(DiffEntrySchema), driftCount: Type.Integer(), generatedAt: Type.String() }) },
      },
    },
    async (_request, reply) => reply.send((await os.diff()) as never),
  );

  app.get(
    '/api/v2/os/plan',
    {
      schema: {
        tags: ['os'],
        summary: 'Compile the OS change plan (requires approval before apply)',
        response: { 200: PlanSchema },
      },
    },
    async (_request, reply) => reply.send((await os.plan()) as never),
  );

  app.get(
    '/api/v2/os/capabilities',
    {
      schema: {
        tags: ['os'],
        summary: 'List OS capabilities',
        response: { 200: Type.Array(Type.Object({ id: Type.String(), kind: Type.String(), risk: Type.String(), requiresApproval: Type.Boolean(), description: Type.String() })) },
      },
    },
    async (_request, reply) => reply.send(os.capabilities() as never),
  );
};
