import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { ImageBuildService } from '../image/service/image-build-service.js';
import type { VestaraImageProfile, ImageBuildTarget } from '../image/domain/profile.js';

const ErrorSchema = Type.Object({ error: Type.Object({ code: Type.String(), message: Type.String(), requestId: Type.String(), correlationId: Type.String(), retryable: Type.Boolean(), details: Type.Optional(Type.Any()) }) });

const ProfileSchema = Type.Object({
  id: Type.String(),
  version: Type.String(),
  architecture: Type.String(),
  profileHash: Type.String(),
});

export const imageBuilderRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const image = app.application.container.resolve<ImageBuildService>('imageBuilder');

  app.get(
    '/api/v2/image/profiles',
    {
      schema: {
        tags: ['image'],
        summary: 'List image profiles',
        response: { 200: Type.Array(ProfileSchema) },
      },
    },
    async (_request, reply) => reply.send(image.listProfiles() as never),
  );

  app.post(
    '/api/v2/image/profiles',
    {
      schema: {
        tags: ['image'],
        summary: 'Register an image profile',
        body: Type.Any(),
        response: { 201: ProfileSchema },
      },
    },
    async (request, reply) => {
      const profile = image.registerProfile(request.body as Omit<VestaraImageProfile, 'profileHash'>);
      return reply.status(201).send({ id: profile.id, version: profile.version, architecture: profile.architecture, profileHash: profile.profileHash } as never);
    },
  );

  app.post(
    '/api/v2/image/plan',
    {
      schema: {
        tags: ['image'],
        summary: 'Compile an image build plan (no build)',
        body: Type.Object({ profileId: Type.String(), target: Type.String() }),
        response: { 200: Type.Any(), 404: ErrorSchema },
      },
    },
    async (request, reply) => {
      const plan = image.plan(request.body.profileId, request.body.target as ImageBuildTarget);
      return reply.send(plan);
    },
  );

  app.post(
    '/api/v2/image/build',
    {
      schema: {
        tags: ['image'],
        summary: 'Run a governed image build (requires approval)',
        body: Type.Object({ profileId: Type.String(), target: Type.String(), approved: Type.Boolean() }),
        response: { 200: Type.Any(), 403: ErrorSchema },
      },
    },
    async (request, reply) => {
      const result = await image.build(request.body.profileId, request.body.target as ImageBuildTarget, request.body.approved);
      return reply.send(result);
    },
  );

  app.get(
    '/api/v2/image/build/state',
    {
      schema: {
        tags: ['image'],
        summary: 'Current image build state',
        response: { 200: Type.Any() },
      },
    },
    async () => image.getState(),
  );
};
