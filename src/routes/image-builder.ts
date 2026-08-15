import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { ImageBuildService } from '../image/service/image-build-service.js';
import type { DiagnosticExecutor } from '../diagnostics/executor.js';
import type { VestaraImageProfile } from '../image/domain/profile.js';
import {
  BuildRequestSchema,
  ImageBuildPlanSchema,
  ImageBuildResultSchema,
  ImageBuildStateSchema,
  ImageErrorSchema,
  ImageProfileSchema,
  PlanRequestSchema,
  UpdateImageProfileBodySchema,
} from '../image/contracts.js';

export const imageBuilderRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const image = app.application.container.resolve<ImageBuildService>('imageBuilder');
  const diagnostics = app.application.container.resolve<DiagnosticExecutor>('diagnostics.executor');

  app.get(
    '/api/v2/image/profiles',
    {
      schema: {
        tags: ['image'],
        summary: 'List image profiles',
        response: { 200: Type.Array(ImageProfileSchema) },
      },
    },
    async (_request, reply) => reply.send(image.listProfiles() as never),
  );

  app.get(
    '/api/v2/image/profiles/:id',
    {
      schema: {
        tags: ['image'],
        summary: 'Get an image profile',
        params: Type.Object({ id: Type.String() }),
        response: { 200: ImageProfileSchema, 404: ImageErrorSchema },
      },
    },
    async (request, reply) => reply.send(image.getProfile(request.params.id) as never),
  );

  app.post(
    '/api/v2/image/profiles',
    {
      schema: {
        tags: ['image'],
        summary: 'Register an image profile',
        body: ImageProfileSchema,
        response: { 201: ImageProfileSchema },
      },
    },
    async (request, reply) => {
      const body = request.body as VestaraImageProfile;
      const profile = image.registerProfile(body);
      return reply.status(201).send(profile as never);
    },
  );

  app.patch(
    '/api/v2/image/profiles/:id',
    {
      schema: {
        tags: ['image'],
        summary: 'Update an image profile (recomputes profile hash)',
        params: Type.Object({ id: Type.String() }),
        body: UpdateImageProfileBodySchema,
        response: { 200: ImageProfileSchema, 404: ImageErrorSchema },
      },
    },
    async (request, reply) => {
      const profile = image.updateProfile(request.params.id, request.body as never);
      return reply.send(profile as never);
    },
  );

  app.post(
    '/api/v2/image/plan',
    {
      schema: {
        tags: ['image'],
        summary: 'Compile an image build plan (no build)',
        body: PlanRequestSchema,
        response: { 200: ImageBuildPlanSchema, 404: ImageErrorSchema },
      },
    },
    async (request, reply) => {
      const plan = image.plan(request.body.profileId, request.body.target);
      return reply.send(plan as never);
    },
  );

  app.post(
    '/api/v2/image/build',
    {
      schema: {
        tags: ['image'],
        summary: 'Run a governed image build (requires approval)',
        body: BuildRequestSchema,
        response: { 200: ImageBuildResultSchema, 403: ImageErrorSchema },
      },
    },
    async (request, reply) => {
      const result = await image.build(request.body.profileId, request.body.target, request.body.approved);
      return reply.send(result as never);
    },
  );

  app.get(
    '/api/v2/image/build/state',
    {
      schema: {
        tags: ['image'],
        summary: 'Current image build state',
        response: { 200: ImageBuildStateSchema },
      },
    },
    async () => image.getState() as never,
  );

  const DiagnosticRunViewSchema = Type.Object({
    id: Type.String(),
    scope: Type.String(),
    status: Type.String(),
    startedAt: Type.String(),
    completedAt: Type.Optional(Type.String()),
    counts: Type.Object({ healthy: Type.Integer(), degraded: Type.Integer(), failed: Type.Integer() }),
    checks: Type.Array(
      Type.Object({
        checkId: Type.String(),
        status: Type.String(),
        severity: Type.String(),
        message: Type.String(),
        detail: Type.Optional(Type.String()),
      }),
    ),
  });

  app.post(
    '/api/v2/image/diagnostics',
    {
      schema: {
        tags: ['image'],
        summary: 'Run Image Builder diagnostics (connectivity, capability, profiles)',
        response: { 200: DiagnosticRunViewSchema },
      },
    },
    async (_request, reply) => {
      const run = await diagnostics.run({ scope: 'module', moduleId: 'image-builder' });
      return reply.send({
        id: run.id,
        scope: run.scope,
        status: run.status,
        startedAt: run.startedAt,
        ...(run.completedAt !== undefined ? { completedAt: run.completedAt } : {}),
        counts: run.counts,
        checks: run.checks.map((c) => ({
          checkId: c.checkId,
          status: c.status,
          severity: c.severity,
          message: c.message,
          ...(c.detail !== undefined ? { detail: c.detail } : {}),
        })),
      } as never);
    },
  );
};
