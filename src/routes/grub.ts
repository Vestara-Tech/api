import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { GrubConfigurationService } from '../system/grub/service/grub-configuration-service.js';

const ErrorSchema = Type.Object({
  error: Type.Object({ code: Type.String(), message: Type.String(), requestId: Type.String(), correlationId: Type.String(), retryable: Type.Boolean(), details: Type.Optional(Type.Any()) }),
});

const GrubConfigSchema = Type.Object({
  defaultEntry: Type.Optional(Type.String()),
  timeoutSeconds: Type.Integer(),
  timeoutStyle: Type.Union([Type.Literal('menu'), Type.Literal('countdown'), Type.Literal('hidden')]),
  distributor: Type.Optional(Type.String()),
  kernelParameters: Type.Array(Type.String()),
  graphics: Type.Optional(Type.Object({ mode: Type.Optional(Type.String()), payload: Type.Optional(Type.String()) })),
  recovery: Type.Object({ enabled: Type.Boolean() }),
  osProber: Type.Object({ enabled: Type.Boolean() }),
});

const GrubPreviewSchema = Type.Object({
  current: Type.Optional(Type.Object({ configuration: GrubConfigSchema, configurationHash: Type.String(), capturedAt: Type.String() })),
  candidate: GrubConfigSchema,
  candidateHash: Type.String(),
  changed: Type.Boolean(),
  validation: Type.Object({ ok: Type.Boolean(), issues: Type.Array(Type.String()) }),
  requiresReboot: Type.Boolean(),
  previewHash: Type.String(),
});

const BootEntrySchema = Type.Object({
  id: Type.String(),
  label: Type.String(),
  source: Type.String(),
  active: Type.Boolean(),
  isVestara: Type.Boolean(),
});

export const grubRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const grub = app.application.container.resolve<GrubConfigurationService>('grubConfiguration');

  app.get(
    '/api/v2/system/boot/grub',
    {
      schema: {
        tags: ['system-grub'],
        summary: 'Read the current GRUB configuration',
        response: { 200: Type.Object({ configuration: Type.Optional(GrubConfigSchema), state: Type.Any() }) },
      },
    },
    async (_request, reply) => {
      const configuration = await grub.read();
      return reply.send({ ...(configuration !== null ? { configuration } : {}), state: grub.getState() } as never);
    },
  );

  app.get(
    '/api/v2/system/boot/grub/capabilities',
    {
      schema: {
        tags: ['system-grub'],
        summary: 'GRUB configuration capabilities',
        response: { 200: Type.Object({ read: Type.Boolean(), write: Type.Boolean(), regenerate: Type.Boolean(), backup: Type.Boolean(), entries: Type.Boolean(), theme: Type.Boolean() }) },
      },
    },
    async () => grub.capabilities(),
  );

  app.get(
    '/api/v2/system/boot/grub/entries',
    {
      schema: {
        tags: ['system-grub'],
        summary: 'List GRUB boot entries',
        response: { 200: Type.Array(BootEntrySchema) },
      },
    },
    async (_request, reply) => reply.send((await grub.listEntries()) as never),
  );

  app.post(
    '/api/v2/system/boot/grub/validate',
    {
      schema: {
        tags: ['system-grub'],
        summary: 'Validate a GRUB configuration proposal',
        body: GrubConfigSchema,
        response: { 200: GrubPreviewSchema },
      },
    },
    async (request, reply) => {
      const preview = await grub.validate(request.body as never);
      return reply.send(preview as never);
    },
  );

  app.post(
    '/api/v2/system/boot/grub/preview',
    {
      schema: {
        tags: ['system-grub'],
        summary: 'Preview GRUB configuration changes',
        body: GrubConfigSchema,
        response: { 200: GrubPreviewSchema },
      },
    },
    async (request, reply) => {
      const preview = await grub.preview(request.body as never);
      return reply.send(preview as never);
    },
  );

  app.post(
    '/api/v2/system/boot/grub/apply',
    {
      schema: {
        tags: ['system-grub'],
        summary: 'Apply a GRUB configuration (requires approval)',
        body: Type.Object({ configuration: GrubConfigSchema, approved: Type.Boolean() }),
        response: { 200: GrubPreviewSchema, 400: ErrorSchema, 403: ErrorSchema },
      },
    },
    async (request, reply) => {
      const preview = await grub.apply(request.body.configuration as never, request.body.approved);
      return reply.send(preview as never);
    },
  );

  app.post(
    '/api/v2/system/boot/grub/rollback',
    {
      schema: {
        tags: ['system-grub'],
        summary: 'Roll back the GRUB configuration',
        response: { 200: Type.Any() },
      },
    },
    async () => grub.rollback(),
  );

  app.post(
    '/api/v2/system/boot/grub/boot-result',
    {
      schema: {
        tags: ['system-grub'],
        summary: 'Record GRUB boot success/failure',
        body: Type.Object({ succeeded: Type.Boolean() }),
        response: { 200: Type.Any() },
      },
    },
    async (request) => grub.recordBootResult(request.body.succeeded),
  );

  app.post(
    '/api/v2/system/boot/grub/default',
    {
      schema: {
        tags: ['system-grub'],
        summary: 'Set the default GRUB entry',
        body: Type.Object({ entryId: Type.String() }),
        response: { 200: Type.Object({ ok: Type.Boolean(), entryId: Type.String() }), 404: ErrorSchema },
      },
    },
    async (request, reply) => {
      const result = await grub.setDefault(request.body.entryId);
      return reply.send(result);
    },
  );

  app.post(
    '/api/v2/system/boot/grub/next',
    {
      schema: {
        tags: ['system-grub'],
        summary: 'Set the next-boot GRUB entry',
        body: Type.Object({ entryId: Type.String() }),
        response: { 200: Type.Object({ ok: Type.Boolean(), entryId: Type.String() }), 404: ErrorSchema },
      },
    },
    async (request, reply) => {
      const result = await grub.setNext(request.body.entryId);
      return reply.send(result);
    },
  );

  app.post(
    '/api/v2/system/boot/grub/theme/preview',
    {
      schema: {
        tags: ['system-grub'],
        summary: 'Validate a GRUB theme proposal',
        body: Type.Object({ theme: Type.Optional(Type.Object({ assetId: Type.String(), sha256: Type.String(), mediaType: Type.String() })) }),
        response: { 200: Type.Object({ ok: Type.Boolean() }), 404: ErrorSchema },
      },
    },
    async (request, reply) => {
      // Theme preview resolves the asset via the store inside the service.
      const theme = request.body.theme;
      if (!theme) return reply.send({ ok: false });
      const asset = await grub.assetExists(theme.assetId);
      if (!asset) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: `Theme asset "${theme.assetId}" not found`, requestId: request.ctx.requestId, correlationId: request.ctx.correlationId, retryable: false } });
      return reply.send({ ok: true });
    },
  );

  app.post(
    '/api/v2/system/boot/grub/theme/apply',
    {
      schema: {
        tags: ['system-grub'],
        summary: 'Apply the GRUB theme',
        body: Type.Object({ theme: Type.Optional(Type.Object({ assetId: Type.String(), sha256: Type.String(), mediaType: Type.String() })) }),
        response: { 200: Type.Object({ ok: Type.Boolean() }), 404: ErrorSchema },
      },
    },
    async (request, reply) => {
      const result = await grub.applyTheme(request.body.theme, undefined);
      return reply.send(result);
    },
  );
};
