import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { GenerationService } from '../generator/service/generation-service.js';
import type { GeneratorRegistry } from '../generator/registry/generator-registry.js';
import { ArtifactValidationPipeline, noRawSecretsRule } from '../generator/validation/pipeline.js';
import { createConfigurationSnapshot, type ResolvedConfigValue } from '../generator/context/configuration-snapshot.js';
import type { ConfigurationService } from '../configuration/service/configuration-service.js';
import { snapshotFromConfiguration } from '../bootstrap/generator.js';

const ErrorSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    requestId: Type.String(),
    correlationId: Type.String(),
    retryable: Type.Boolean(),
    details: Type.Optional(Type.Any()),
  }),
});

const GeneratorDescriptorSchema = Type.Object({
  id: Type.String(),
  version: Type.String(),
  capabilities: Type.Array(Type.String()),
  requiresSecrets: Type.Boolean(),
});

const PlanSchema = Type.Object({
  id: Type.String(),
  generatorId: Type.String(),
  inputHash: Type.String(),
  steps: Type.Array(
    Type.Object({ id: Type.String(), kind: Type.String(), description: Type.String() }),
  ),
  requirements: Type.Array(
    Type.Object({ id: Type.String(), label: Type.String(), satisfied: Type.Boolean() }),
  ),
  warnings: Type.Array(Type.Object({ code: Type.String(), message: Type.String() })),
  planHash: Type.String(),
});

const EvidenceSchema = Type.Object({
  generatorId: Type.String(),
  generatorVersion: Type.String(),
  inputHash: Type.String(),
  configurationHash: Type.String(),
  outputHash: Type.String(),
  evidenceHash: Type.String(),
});

const RunResultSchema = Type.Object({
  artifacts: Type.Array(
    Type.Object({ path: Type.String(), contentHash: Type.String(), encoding: Type.String() }),
  ),
  output: Type.Any(),
  evidence: EvidenceSchema,
});

const PreviewSchema = Type.Object({
  generatorId: Type.String(),
  generatorVersion: Type.String(),
  totalFiles: Type.Integer(),
  additions: Type.Integer(),
  removals: Type.Integer(),
  changes: Type.Integer(),
  previewHash: Type.String(),
  diff: Type.Array(
    Type.Object({
      path: Type.String(),
      operation: Type.String(),
      newContentHash: Type.String(),
      addedLines: Type.Integer(),
      removedLines: Type.Integer(),
    }),
  ),
});

const ValidationSchema = Type.Object({
  ok: Type.Boolean(),
  validatedArtifactCount: Type.Integer(),
  issues: Type.Array(
    Type.Object({ path: Type.String(), severity: Type.String(), message: Type.String(), code: Type.String() }),
  ),
});

const ApplyResultSchema = Type.Object({
  appliedFiles: Type.Array(Type.String()),
  skippedFiles: Type.Array(Type.String()),
  appliedAt: Type.String(),
  applyHash: Type.String(),
});

const VerificationSchema = Type.Object({
  verified: Type.Boolean(),
  checks: Type.Array(Type.Object({ path: Type.String(), ok: Type.Boolean(), detail: Type.Optional(Type.String()) })),
});

export const generatorRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const registry = app.application.container.resolve<GeneratorRegistry>('generator.registry');
  const service = app.application.container.resolve<GenerationService>('generator.service');
  const configuration = app.application.container.resolve<ConfigurationService>('configuration');
  const validation = new ArtifactValidationPipeline([noRawSecretsRule], { maxTotalBytes: 1_000_000, maxFileCount: 500 });

  app.get(
    '/api/v2/generator/generators',
    {
      schema: {
        tags: ['generator'],
        summary: 'List registered generators',
        response: { 200: Type.Array(GeneratorDescriptorSchema) },
      },
    },
    async (_request, reply) =>
      reply.send(
        registry.list().map((g) => ({
          id: g.id,
          version: g.version,
          capabilities: g.capabilities,
          requiresSecrets: g.requiresSecrets,
        })) as never,
      ),
  );

  app.get(
    '/api/v2/generator/capabilities',
    {
      schema: {
        tags: ['generator'],
        summary: 'List all generator capabilities',
        response: { 200: Type.Array(Type.String()) },
      },
    },
    async (_request, reply) => reply.send(registry.capabilities() as never),
  );

  app.post(
    '/api/v2/generator/plan',
    {
      schema: {
        tags: ['generator'],
        summary: 'Plan a generation without generating',
        body: Type.Object({ generatorId: Type.String(), input: Type.Any() }),
        response: { 200: PlanSchema, 404: ErrorSchema },
      },
    },
    async (request, reply) => {
      const configurationSnapshot = snapshotFromConfiguration(configuration);
      const { plan } = await service.plan({ generatorId: request.body.generatorId, input: request.body.input, configuration: configurationSnapshot });
      return reply.send(plan as never);
    },
  );

  app.post(
    '/api/v2/generator/run',
    {
      schema: {
        tags: ['generator'],
        summary: 'Run a generation (no apply)',
        body: Type.Object({
          generatorId: Type.String(),
          input: Type.Any(),
          requiresSecrets: Type.Optional(Type.Boolean()),
          policyApprovedSecrets: Type.Optional(Type.Boolean()),
        }),
        response: { 200: RunResultSchema, 403: ErrorSchema, 404: ErrorSchema },
      },
    },
    async (request, reply) => {
      const configurationSnapshot = snapshotFromConfiguration(configuration);
      const result = await service.run({
        generatorId: request.body.generatorId,
        input: request.body.input,
        configuration: configurationSnapshot,
        ...(request.body.requiresSecrets !== undefined ? { requiresSecrets: request.body.requiresSecrets } : {}),
        ...(request.body.policyApprovedSecrets !== undefined ? { policyApprovedSecrets: request.body.policyApprovedSecrets } : {}),
      });
      return reply.send({
        artifacts: result.artifacts.all().map((a) => ({ path: a.path, contentHash: a.contentHash, encoding: a.encoding })),
        output: result.output,
        evidence: result.evidence,
      });
    },
  );

  app.post(
    '/api/v2/generator/preview',
    {
      schema: {
        tags: ['generator'],
        summary: 'Preview a generation as a diff against a target directory',
        body: Type.Object({
          generatorId: Type.String(),
          input: Type.Any(),
          target: Type.Optional(
            Type.Object({
              basePath: Type.String(),
              existing: Type.Optional(Type.Array(Type.Object({ path: Type.String(), content: Type.String() }))),
            }),
          ),
        }),
        response: { 200: PreviewSchema, 404: ErrorSchema },
      },
    },
    async (request, reply) => {
      const configurationSnapshot = snapshotFromConfiguration(configuration);
      const existing = new Map((request.body.target?.existing ?? []).map((f) => [f.path, f.content]));
      const reader = {
        async read(path: string) {
          return existing.get(path) ?? null;
        },
        async exists(path: string) {
          return existing.has(path);
        },
      };
      const preview = await service.preview({
        input: {
          generatorId: request.body.generatorId,
          input: request.body.input,
          configuration: configurationSnapshot,
        },
        targetReader: reader,
        previewHash: 'preview-1',
      });
      return reply.send(preview as never);
    },
  );

  app.post(
    '/api/v2/generator/apply',
    {
      schema: {
        tags: ['generator'],
        summary: 'Apply a generation (validate → preview → write → verify)',
        body: Type.Object({
          generatorId: Type.String(),
          input: Type.Any(),
          approved: Type.Boolean(),
          target: Type.Optional(
            Type.Object({
              existing: Type.Optional(Type.Array(Type.Object({ path: Type.String(), content: Type.String() }))),
            }),
          ),
        }),
        response: {
          200: Type.Object({
            validation: ValidationSchema,
            preview: PreviewSchema,
            apply: ApplyResultSchema,
            verification: VerificationSchema,
            evidence: EvidenceSchema,
          }),
          400: ErrorSchema,
          403: ErrorSchema,
          404: ErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const configurationSnapshot = snapshotFromConfiguration(configuration);
      const written = new Map<string, string>();
      const existing = new Map((request.body.target?.existing ?? []).map((f) => [f.path, f.content]));
      const applyPort = {
        async write(path: string, content: string) {
          written.set(path, content);
        },
        async exists(path: string) {
          return written.has(path) || existing.has(path);
        },
      };
      const applied = await service.applyFlow(
        {
          input: {
            generatorId: request.body.generatorId,
            input: request.body.input,
            configuration: configurationSnapshot,
          },
          targetReader: {
            async read(path: string) {
              return existing.get(path) ?? written.get(path) ?? null;
            },
            async exists(path: string) {
              return existing.has(path) || written.has(path);
            },
          },
          previewHash: 'apply-1',
        },
        validation,
        applyPort,
        request.body.approved,
      );
      return reply.send({
        validation: applied.validation,
        preview: applied.preview,
        apply: applied.apply,
        verification: applied.verification,
        evidence: applied.result.evidence,
      } as never);
    },
  );
};
