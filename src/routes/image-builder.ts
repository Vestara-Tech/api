import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { ImageBuildService } from '../image/service/image-build-service.js';
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
};
