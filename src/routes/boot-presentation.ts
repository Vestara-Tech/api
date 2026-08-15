import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { BootPresentationService } from '../system/boot-presentation/service/boot-presentation-service.js';

const ErrorSchema = Type.Object({
  error: Type.Object({ code: Type.String(), message: Type.String(), requestId: Type.String(), correlationId: Type.String(), retryable: Type.Boolean(), details: Type.Optional(Type.Any()) }),
});

const BootAssetRefSchema = Type.Object({ assetId: Type.String(), sha256: Type.String(), mediaType: Type.String() });
const PlymouthSchema = Type.Object({
  logo: Type.Optional(BootAssetRefSchema),
  animation: Type.Optional(BootAssetRefSchema),
  background: Type.Optional(BootAssetRefSchema),
  progressStyle: Type.Optional(Type.String()),
});
const GrubSchema = Type.Object({
  background: Type.Optional(BootAssetRefSchema),
  logo: Type.Optional(BootAssetRefSchema),
  theme: Type.Optional(BootAssetRefSchema),
});
const FirmwareSchema = Type.Object({ logo: Type.Optional(BootAssetRefSchema) });

const ProfileSchema = Type.Object({
  id: Type.String(),
  version: Type.Integer(),
  name: Type.String(),
  plymouth: Type.Optional(PlymouthSchema),
  grub: Type.Optional(GrubSchema),
  firmware: Type.Optional(FirmwareSchema),
  profileHash: Type.String(),
});

const PreviewSchema = Type.Object({
  profile: ProfileSchema,
  changes: Type.Array(Type.Object({ target: Type.String(), action: Type.String(), detail: Type.String() })),
  validation: Type.Array(Type.Object({ target: Type.String(), ok: Type.Boolean(), issues: Type.Array(Type.String()) })),
  requiresReboot: Type.Boolean(),
  previewHash: Type.String(),
});

const StateSchema = Type.Object({
  status: Type.String(),
  currentProfileId: Type.Optional(Type.String()),
  pendingVerificationProfileId: Type.Optional(Type.String()),
  bootAttempts: Type.Integer(),
});

const FirmwareLogoCapabilitiesSchema = Type.Object({
  readable: Type.Boolean(),
  writable: Type.Boolean(),
  replaceable: Type.Boolean(),
  restoreSupported: Type.Boolean(),
  requiresReboot: Type.Boolean(),
  mechanism: Type.String(),
  vendor: Type.Optional(Type.String()),
  reason: Type.Optional(Type.String()),
});

const AssetSchema = Type.Object({
  assetId: Type.String(),
  sha256: Type.String(),
  mediaType: Type.String(),
  name: Type.String(),
  sizeBytes: Type.Integer(),
  createdAt: Type.String(),
});

export const bootPresentationRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const boot = app.application.container.resolve<BootPresentationService>('bootPresentation');

  app.get(
    '/api/v2/system/boot/presentation',
    {
      schema: {
        tags: ['system-boot'],
        summary: 'Current boot presentation state',
        response: { 200: StateSchema },
      },
    },
    async () => boot.getState(),
  );

  app.get(
    '/api/v2/system/boot/presentation/capabilities',
    {
      schema: {
        tags: ['system-boot'],
        summary: 'Boot presentation capabilities',
        response: { 200: Type.Object({ plymouth: Type.Boolean(), grub: Type.Boolean() }) },
      },
    },
    async () => ({ plymouth: true, grub: true }),
  );

  app.get(
    '/api/v2/system/boot/presentation/profiles',
    {
      schema: {
        tags: ['system-boot'],
        summary: 'List boot presentation profiles',
        response: { 200: Type.Array(ProfileSchema) },
      },
    },
    async (_request, reply) => reply.send((await boot.listProfiles()) as never),
  );

  app.post(
    '/api/v2/system/boot/presentation/profiles',
    {
      schema: {
        tags: ['system-boot'],
        summary: 'Save a boot presentation profile',
        body: Type.Object({
          id: Type.String(),
          version: Type.Integer(),
          name: Type.String(),
          plymouth: Type.Optional(PlymouthSchema),
          grub: Type.Optional(GrubSchema),
          firmware: Type.Optional(FirmwareSchema),
        }),
        response: { 201: ProfileSchema },
      },
    },
    async (request, reply) => {
      const body = request.body;
      const profile = await boot.saveProfile(body as never);
      return reply.status(201).send(profile as never);
    },
  );

  app.post(
    '/api/v2/system/boot/presentation/assets',
    {
      schema: {
        tags: ['system-boot'],
        summary: 'Store a managed boot asset (no raw filesystem paths)',
        body: Type.Object({ name: Type.String(), mediaType: Type.Optional(Type.String()), contentBase64: Type.String() }),
        response: { 201: AssetSchema, 400: ErrorSchema },
      },
    },
    async (request, reply) => {
      const body = request.body;
      const bytes = Buffer.from(body.contentBase64, 'base64');
      const asset = await boot.storeAsset({ name: body.name, bytes, ...(body.mediaType !== undefined ? { mediaType: body.mediaType } : {}) });
      return reply.status(201).send(asset);
    },
  );

  app.post(
    '/api/v2/system/boot/presentation/preview',
    {
      schema: {
        tags: ['system-boot'],
        summary: 'Preview a profile (validate + plan, no apply)',
        body: Type.Object({ profileId: Type.String() }),
        response: { 200: PreviewSchema, 400: ErrorSchema },
      },
    },
    async (request, reply) => {
      const preview = await boot.preview(request.body.profileId);
      return reply.send(preview as never);
    },
  );

  app.post(
    '/api/v2/system/boot/presentation/validate',
    {
      schema: {
        tags: ['system-boot'],
        summary: 'Validate a profile',
        body: Type.Object({ profileId: Type.String() }),
        response: { 200: Type.Any() },
      },
    },
    async (request) => {
      const preview = await boot.preview(request.body.profileId);
      return { ok: preview.validation.every((v) => v.ok), issues: preview.validation.flatMap((v) => v.issues) };
    },
  );

  app.post(
    '/api/v2/system/boot/presentation/apply',
    {
      schema: {
        tags: ['system-boot'],
        summary: 'Apply a profile (requires approval)',
        body: Type.Object({ profileId: Type.String(), approved: Type.Boolean() }),
        response: { 200: PreviewSchema, 400: ErrorSchema, 403: ErrorSchema },
      },
    },
    async (request, reply) => {
      const preview = await boot.apply(request.body.profileId, request.body.approved);
      return reply.send(preview as never);
    },
  );

  app.post(
    '/api/v2/system/boot/presentation/rollback',
    {
      schema: {
        tags: ['system-boot'],
        summary: 'Roll back the boot presentation',
        response: { 200: StateSchema },
      },
    },
    async () => boot.rollback(),
  );

  app.post(
    '/api/v2/system/boot/presentation/boot-result',
    {
      schema: {
        tags: ['system-boot'],
        summary: 'Record boot success/failure for reboot verification',
        body: Type.Object({ succeeded: Type.Boolean() }),
        response: { 200: StateSchema },
      },
    },
    async (request) => boot.recordBootResult(request.body.succeeded),
  );

  // ── Firmware logo (SYS-022/023) ─────────────────────────────

  app.get(
    '/api/v2/system/firmware/logo/capabilities',
    {
      schema: {
        tags: ['system-boot'],
        summary: 'Firmware-logo capabilities (separate, CRITICAL)',
        response: { 200: FirmwareLogoCapabilitiesSchema },
      },
    },
    async () => boot.firmwareLogoCapabilities(),
  );

  app.post(
    '/api/v2/system/firmware/logo/preview',
    {
      schema: {
        tags: ['system-boot'],
        summary: 'Preview firmware-logo replacement (requires supported hardware)',
        body: Type.Object({ assetId: Type.String() }),
        response: { 200: Type.Object({ willReplace: Type.Boolean(), requiresReboot: Type.Boolean() }), 400: ErrorSchema, 409: ErrorSchema },
      },
    },
    async (request, reply) => {
      const result = await boot.firmareLogoPreview(request.body.assetId);
      return reply.send(result);
    },
  );

  app.post(
    '/api/v2/system/firmware/logo/apply',
    {
      schema: {
        tags: ['system-boot'],
        summary: 'Apply firmware-logo replacement (special policy + supported hardware)',
        body: Type.Object({ assetId: Type.String(), specialPolicyApproved: Type.Boolean() }),
        response: { 200: Type.Object({ ok: Type.Boolean(), message: Type.Optional(Type.String()) }), 400: ErrorSchema, 403: ErrorSchema, 409: ErrorSchema },
      },
    },
    async (request, reply) => {
      const result = await boot.applyFirmwareLogo(request.body.assetId, request.body.specialPolicyApproved);
      return reply.send(result);
    },
  );

  app.post(
    '/api/v2/system/firmware/logo/restore',
    {
      schema: {
        tags: ['system-boot'],
        summary: 'Restore the original firmware logo',
        response: { 200: Type.Object({ ok: Type.Boolean(), message: Type.Optional(Type.String()) }), 409: ErrorSchema },
      },
    },
    async (request, reply) => {
      const result = await boot.restoreFirmwareLogo();
      return reply.send(result);
    },
  );
};
