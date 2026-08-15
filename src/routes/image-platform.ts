import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { ImagePlatformV2 } from '../image/service/image-platform-v2.js';
import type { ImageExecutionPipeline } from '../image/service/image-execution-pipeline.js';

const PartitionSchema = Type.Object({
  name: Type.String(),
  kind: Type.String(),
  sizeBytes: Type.Integer(),
  filesystem: Type.String(),
  encryption: Type.Optional(Type.String()),
  mountPoint: Type.Optional(Type.String()),
  label: Type.Optional(Type.String()),
});

const PartitionLayoutSchema = Type.Object({
  tableType: Type.String(),
  diskSizeBytes: Type.Integer(),
  partitions: Type.Array(PartitionSchema),
});

const LifecycleSchema = Type.Object({
  id: Type.String(),
  status: Type.String(),
  currentRevision: Type.Integer(),
  revisions: Type.Array(Type.Integer()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
  publishedAt: Type.Optional(Type.String()),
});

const PackageLockViewSchema = Type.Object({
  lockHash: Type.String(),
  locked: Type.Array(Type.Object({ name: Type.String(), version: Type.String(), hash: Type.String() })),
  warnings: Type.Array(Type.String()),
  resolvedAt: Type.String(),
});

const PlanV2ItemSchema = Type.Object({
  stage: Type.String(),
  description: Type.String(),
  generated: Type.Array(Type.String()),
  status: Type.String(),
});

const PlanV2Schema = Type.Object({
  profileId: Type.String(),
  profileHash: Type.String(),
  target: Type.String(),
  hardwareId: Type.String(),
  hardwareName: Type.String(),
  architecture: Type.String(),
  items: Type.Array(PlanV2ItemSchema),
  warnings: Type.Array(Type.Object({ message: Type.String(), stage: Type.Optional(Type.String()) })),
  blockingErrors: Type.Array(Type.String()),
  packageLockHash: Type.String(),
  partitionOk: Type.Boolean(),
  estimatedSizeBytes: Type.Optional(Type.Integer()),
  planHash: Type.String(),
});

const PreflightItemSchema = Type.Object({
  name: Type.String(),
  status: Type.String(),
  message: Type.String(),
  category: Type.String(),
});

const PreflightSchema = Type.Object({
  verdict: Type.String(),
  items: Type.Array(PreflightItemSchema),
  blockingCount: Type.Integer(),
  warningCount: Type.Integer(),
  checkedAt: Type.String(),
});

const BuildRunStageSchema = Type.Object({
  stage: Type.String(),
  status: Type.String(),
  log: Type.Array(Type.String()),
  retries: Type.Integer(),
  checkpointed: Type.Boolean(),
  error: Type.Optional(Type.String()),
});

const BuildRunSchema = Type.Object({
  id: Type.String(),
  profileId: Type.String(),
  target: Type.String(),
  status: Type.String(),
  stages: Type.Array(BuildRunStageSchema),
  createdAt: Type.String(),
  startedAt: Type.Optional(Type.String()),
  completedAt: Type.Optional(Type.String()),
  error: Type.Optional(Type.String()),
  resumedFromStage: Type.Optional(Type.String()),
});

/**
 * IMG-031..041 — Image Platform V2 control API. Profile lifecycle, hardware
 * targets, partition layouts, package locks, BuildPlan V2, preflight and
 * resumable build runs.
 */
export const imagePlatformRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const platform = app.application.container.resolve<ImagePlatformV2>('image.platformV2');
  const execution = app.application.container.resolve<ImageExecutionPipeline>('image.execution');

  // ── IMG-033 hardware targets ───────────────────────────────────
  app.get(
    '/api/v2/image/hardware-targets',
    {
      schema: {
        tags: ['image'],
        summary: 'List supported hardware targets',
        response: {
          200: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
            description: Type.String(),
            architecture: Type.String(),
            firmware: Type.String(),
            secureBoot: Type.Boolean(),
            tpm: Type.String(),
          })),
        },
      },
    },
    async (_request, reply) => reply.send(platform.hardwareTargets().map((t) => ({ id: t.id, name: t.name, description: t.description, architecture: t.architecture, firmware: t.firmware, secureBoot: t.secureBoot, tpm: t.tpm })) as never),
  );

  // ── IMG-034 partition designer ────────────────────────────────
  app.get(
    '/api/v2/image/partitions/:profileId/layout',
    {
      schema: {
        tags: ['image'],
        summary: 'Default partition layout for a profile',
        params: Type.Object({ profileId: Type.String() }),
        response: { 200: PartitionLayoutSchema },
      },
    },
    async (request, reply) => reply.send(platform.partitionLayout(request.params.profileId) as never),
  );

  app.post(
    '/api/v2/image/partitions/validate',
    {
      schema: {
        tags: ['image'],
        summary: 'Validate a partition layout before build',
        body: PartitionLayoutSchema,
        response: { 200: Type.Object({ ok: Type.Boolean(), issues: Type.Array(Type.Object({ message: Type.String(), severity: Type.String() })) }) },
      },
    },
    async (request, reply) => reply.send(platform.validatePartitions(request.body as never) as never),
  );

  // ── IMG-031 profile lifecycle ─────────────────────────────────
  app.get(
    '/api/v2/image/profiles/:id/lifecycle',
    {
      schema: {
        tags: ['image'],
        summary: 'Profile lifecycle state',
        params: Type.Object({ id: Type.String() }),
        response: { 200: LifecycleSchema },
      },
    },
    async (request, reply) => reply.send(platform.lifecycle(request.params.id) as never),
  );

  app.post(
    '/api/v2/image/profiles/:id/transition',
    {
      schema: {
        tags: ['image'],
        summary: 'Advance a profile lifecycle (validate/approve/publish/...)',
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({ transition: Type.String() }),
        response: { 200: LifecycleSchema },
      },
    },
    async (request, reply) => reply.send(platform.transition(request.params.id, request.body.transition as never) as never),
  );

  // ── IMG-036 package lock ──────────────────────────────────────
  app.get(
    '/api/v2/image/packages/:profileId/lock',
    {
      schema: {
        tags: ['image'],
        summary: 'Resolve and lock packages for a profile',
        params: Type.Object({ profileId: Type.String() }),
        response: { 200: PackageLockViewSchema },
      },
    },
    async (request, reply) => reply.send(platform.resolvePackagesForProfile(request.params.profileId) as never),
  );

  // ── IMG-037 BuildPlan V2 ──────────────────────────────────────
  app.post(
    '/api/v2/image/plan-v2',
    {
      schema: {
        tags: ['image'],
        summary: 'Compile a BuildPlan V2 (profile + hardware + partitions + packages)',
        body: Type.Object({ profileId: Type.String(), target: Type.String(), hardwareId: Type.String() }),
        response: { 200: PlanV2Schema },
      },
    },
    async (request, reply) => reply.send(platform.planV2(request.body.profileId, request.body.target as never, request.body.hardwareId) as never),
  );

  // ── IMG-038 preflight ─────────────────────────────────────────
  app.post(
    '/api/v2/image/preflight',
    {
      schema: {
        tags: ['image'],
        summary: 'Run preflight checks before a build',
        body: Type.Object({
          profileId: Type.String(),
          target: Type.String(),
          hardwareId: Type.String(),
          env: Type.Optional(Type.Object({
            diskFreeBytes: Type.Optional(Type.Integer()),
            memoryAvailableBytes: Type.Optional(Type.Integer()),
            memoryRequiredBytes: Type.Optional(Type.Integer()),
            signingAvailable: Type.Optional(Type.Boolean()),
            outputWritable: Type.Optional(Type.Boolean()),
            repositoryReachable: Type.Optional(Type.Boolean()),
          })),
        }),
        response: { 200: PreflightSchema },
      },
    },
    async (request, reply) => reply.send(platform.preflight(request.body as never) as never),
  );

  // ── IMG-039/040 build runs ────────────────────────────────────
  app.post(
    '/api/v2/image/runs',
    {
      schema: {
        tags: ['image'],
        summary: 'Start a persistent, resumable build run',
        body: Type.Object({ profileId: Type.String(), target: Type.String() }),
        response: { 201: BuildRunSchema },
      },
    },
    async (request, reply) => reply.status(201).send(platform.createRun(request.body.profileId, request.body.target as never) as never),
  );

  app.post(
    '/api/v2/image/runs/resume',
    {
      schema: {
        tags: ['image'],
        summary: 'Resume a failed/cancelled build run from its last checkpoint',
        body: Type.Object({ profileId: Type.String(), target: Type.String(), runId: Type.Optional(Type.String()) }),
        response: { 201: BuildRunSchema },
      },
    },
    async (request, reply) => reply.status(201).send(platform.resumeRun(request.body.profileId, request.body.target as never, request.body.runId) as never),
  );

  app.get(
    '/api/v2/image/runs',
    {
      schema: {
        tags: ['image'],
        summary: 'List build runs',
        response: { 200: Type.Array(Type.Object({ id: Type.String(), profileId: Type.String(), target: Type.String(), status: Type.String(), createdAt: Type.String() })) },
      },
    },
    async (_request, reply) => reply.send(platform.runs().map((r) => ({ id: r.id, profileId: r.profileId, target: r.target, status: r.status, createdAt: r.createdAt })) as never),
  );

  app.get(
    '/api/v2/image/runs/:id',
    {
      schema: {
        tags: ['image'],
        summary: 'Get a build run with stage checkpoints',
        params: Type.Object({ id: Type.String() }),
        response: { 200: BuildRunSchema },
      },
    },
    async (request, reply) => reply.send(platform.run(request.params.id) as never),
  );

  // ── IMG-043..058 execution pipeline ──────────────────────────
  const ExecutionResultSchema = Type.Object({
    runId: Type.String(),
    status: Type.String(),
    artifactPath: Type.String(),
    startedAt: Type.String(),
    completedAt: Type.Optional(Type.String()),
    error: Type.Optional(Type.String()),
    plan: Type.Object({ profileId: Type.String(), planHash: Type.String(), hardwareId: Type.String(), items: Type.Array(PlanV2ItemSchema) }),
    artifacts: Type.Array(Type.Object({ kind: Type.String(), path: Type.String(), artifactHash: Type.String(), generatedBy: Type.String() })),
    sbom: Type.Object({ format: Type.String(), version: Type.String(), sbomHash: Type.String(), packages: Type.Array(Type.Object({ name: Type.String(), version: Type.String(), hash: Type.String() })) }),
    verification: Type.Optional(Type.Object({ ok: Type.Boolean(), reached: Type.Array(Type.String()), missing: Type.Array(Type.String()), verificationHash: Type.String() })),
    performance: Type.Optional(Type.Object({ totalMs: Type.Integer(), readyMs: Type.Integer(), samples: Type.Array(Type.Object({ stage: Type.String(), durationMs: Type.Integer() })) })),
    signatures: Type.Array(Type.Object({ artifact: Type.String(), signature: Type.String(), signer: Type.String() })),
    seal: Type.Optional(Type.Object({ imageHash: Type.String(), sealHash: Type.String() })),
    evidence: Type.Optional(Type.Object({ bundleHash: Type.String(), planHash: Type.String(), sbomHash: Type.String(), sealHash: Type.String() })),
  });

  app.post(
    '/api/v2/image/execute',
    {
      schema: {
        tags: ['image'],
        summary: 'Run the full execution pipeline (generate -> assemble -> verify -> sign -> seal -> evidence)',
        body: Type.Object({ profileId: Type.String(), target: Type.String(), hardwareId: Type.String(), runId: Type.Optional(Type.String()) }),
        response: { 200: ExecutionResultSchema },
      },
    },
    async (request, reply) => {
      const runId = request.body.runId ?? `run_${Date.now()}`;
      const result = await execution.execute({ profileId: request.body.profileId, target: request.body.target as never, hardwareId: request.body.hardwareId, runId });
      return reply.send(result as never);
    },
  );

  const PublishSchema = Type.Object({
    verdict: Type.String(),
    reason: Type.Optional(Type.String()),
    release: Type.Optional(Type.Object({
      id: Type.String(),
      profileId: Type.String(),
      version: Type.String(),
      buildId: Type.String(),
      verified: Type.Boolean(),
      signed: Type.Boolean(),
      sealed: Type.Boolean(),
      target: Type.String(),
      status: Type.String(),
      artifactPath: Type.String(),
      evidenceBundleHash: Type.String(),
      publishedAt: Type.Optional(Type.String()),
    })),
  });

  app.post(
    '/api/v2/image/publish',
    {
      schema: {
        tags: ['image'],
        summary: 'Publish a completed build (refuses unverified/unsigned/sealed builds)',
        body: Type.Object({
          profileId: Type.String(),
          version: Type.String(),
          buildId: Type.String(),
          verified: Type.Boolean(),
          signed: Type.Boolean(),
          sealed: Type.Boolean(),
          artifactPath: Type.String(),
          evidenceBundleHash: Type.String(),
          target: Type.Optional(Type.String()),
          allowUnverifiedDevBuild: Type.Optional(Type.Boolean()),
        }),
        response: { 200: PublishSchema },
      },
    },
    async (request, reply) => reply.send(execution.publish(request.body as never) as never),
  );

  app.get(
    '/api/v2/image/releases',
    {
      schema: {
        tags: ['image'],
        summary: 'Release history',
        response: {
          200: Type.Array(Type.Object({
            id: Type.String(),
            profileId: Type.String(),
            version: Type.String(),
            buildId: Type.String(),
            verified: Type.Boolean(),
            target: Type.String(),
            status: Type.String(),
            publishedAt: Type.Optional(Type.String()),
            artifactPath: Type.String(),
          })),
        },
      },
    },
    async (_request, reply) => reply.send(execution.releases().map((r) => ({ id: r.id, profileId: r.profileId, version: r.version, buildId: r.buildId, verified: r.verified, target: r.target, status: r.status, publishedAt: r.publishedAt, artifactPath: r.artifactPath })) as never),
  );

  app.get(
    '/api/v2/image/releases/:profileId',
    {
      schema: {
        tags: ['image'],
        summary: 'Release history for a profile',
        params: Type.Object({ profileId: Type.String() }),
        response: {
          200: Type.Array(Type.Object({
            id: Type.String(),
            profileId: Type.String(),
            version: Type.String(),
            buildId: Type.String(),
            verified: Type.Boolean(),
            signed: Type.Boolean(),
            sealed: Type.Boolean(),
            target: Type.String(),
            status: Type.String(),
            artifactPath: Type.String(),
            evidenceBundleHash: Type.String(),
            publishedAt: Type.Optional(Type.String()),
            supersededBy: Type.Optional(Type.String()),
          })),
        },
      },
    },
    async (request, reply) => reply.send(execution.releaseHistory(request.params.profileId) as never),
  );
};
