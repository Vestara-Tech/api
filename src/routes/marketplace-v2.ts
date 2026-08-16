import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { MarketplaceV2 } from '../marketplace/v2/service.js';

const ManifestSchema = Type.Object({
  provides: Type.Array(Type.Object({ kind: Type.String(), id: Type.String(), name: Type.String(), version: Type.Optional(Type.String()), description: Type.Optional(Type.String()) })),
  requires: Type.Array(Type.Object({ module: Type.String(), range: Type.Optional(Type.String()), capability: Type.Optional(Type.String()) })),
  optional: Type.Array(Type.Object({ module: Type.String(), range: Type.Optional(Type.String()), capability: Type.Optional(Type.String()) })),
});

const ContributionSchema = Type.Object({
  packageId: Type.String(),
  version: Type.String(),
  manifest: ManifestSchema,
});

const BundleSchema = Type.Object({
  bundleId: Type.String(),
  name: Type.String(),
  description: Type.Optional(Type.String()),
  packages: Type.Array(Type.Object({ packageId: Type.String(), versionRange: Type.Optional(Type.String()), required: Type.Boolean() })),
  recommended: Type.Array(Type.Object({ packageId: Type.String(), versionRange: Type.Optional(Type.String()) })),
  optional: Type.Array(Type.Object({ packageId: Type.String(), versionRange: Type.Optional(Type.String()) })),
  ai: Type.Optional(Type.Array(Type.String())),
  metadata: Type.Record(Type.String(), Type.Any()),
});

const DistributionSchema = Type.Object({
  distributionId: Type.String(),
  name: Type.String(),
  description: Type.Optional(Type.String()),
  bundles: Type.Array(Type.Object({ bundleId: Type.String(), required: Type.Boolean() })),
  packages: Type.Array(Type.Object({ packageId: Type.String(), required: Type.Boolean(), channel: Type.Optional(Type.String()) })),
  channel: Type.String(),
  curatedBy: Type.String(),
  metadata: Type.Record(Type.String(), Type.Any()),
});

const PublisherSchema = Type.Object({
  publisherId: Type.String(),
  name: Type.String(),
  trustLevel: Type.String(),
  verified: Type.Boolean(),
  website: Type.Optional(Type.String()),
  ownerUserId: Type.Optional(Type.String()),
  organizationId: Type.Optional(Type.String()),
});

/**
 * MKT2 — Marketplace v2 control API. Contributions, capability resolution,
 * bundles, distributions, publishing + trust levels.
 */
export const marketplaceV2Routes: FastifyPluginAsyncTypebox = async (app) => {
  const marketplace = app.application.container.resolve<MarketplaceV2>('marketplace.v2');

  app.get(
    '/api/v2/marketplace-v2/contributions',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'List registered package contributions (provides/requires/optional)',
        response: { 200: Type.Array(ContributionSchema) },
      },
    },
    async (_request, reply) => reply.send(marketplace.contributionRegistry.contributions() as never),
  );

  app.post(
    '/api/v2/marketplace-v2/contributions',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'Register a contribution manifest v2 for a package',
        body: Type.Object({ packageId: Type.String(), version: Type.String(), manifest: ManifestSchema }),
        response: { 201: ContributionSchema },
      },
    },
    async (request, reply) => {
      const body = request.body as { packageId: string; version: string; manifest: unknown };
      marketplace.contributionRegistry.register(body.packageId, body.version, body.manifest as never);
      return reply.status(201).send(request.body as never);
    },
  );

  app.get(
    '/api/v2/marketplace-v2/provides/:kind',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'List packages providing a contribution kind',
        params: Type.Object({ kind: Type.String() }),
        response: { 200: Type.Array(Type.Object({ packageId: Type.String(), id: Type.String(), name: Type.String(), version: Type.Optional(Type.String()) })) },
      },
    },
    async (request, reply) => reply.send(marketplace.contributionRegistry.provides(request.params.kind as never) as never),
  );

  app.post(
    '/api/v2/marketplace-v2/resolve',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'Capability-aware dependency resolution',
        body: ManifestSchema,
        response: { 200: Type.Object({ ok: Type.Boolean(), missingRequired: Type.Array(Type.String()), issues: Type.Array(Type.Object({ module: Type.String(), capability: Type.Optional(Type.String()), required: Type.Boolean(), satisfied: Type.Boolean() })) }) },
      },
    },
    async (request, reply) => reply.send(marketplace.capabilityResolver.resolve(request.body as never) as never),
  );

  app.post(
    '/api/v2/marketplace-v2/bundles',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'Create a package bundle',
        body: Type.Object({
          name: Type.String(),
          description: Type.Optional(Type.String()),
          packages: Type.Array(Type.Object({ packageId: Type.String(), versionRange: Type.Optional(Type.String()), required: Type.Boolean() })),
          recommended: Type.Array(Type.Object({ packageId: Type.String(), versionRange: Type.Optional(Type.String()) })),
          optional: Type.Array(Type.Object({ packageId: Type.String(), versionRange: Type.Optional(Type.String()) })),
          ai: Type.Optional(Type.Array(Type.String())),
          metadata: Type.Record(Type.String(), Type.Any()),
        }),
        response: { 201: BundleSchema },
      },
    },
    async (request, reply) => {
      const bundle = marketplace.distributions.createBundle(request.body as never);
      return reply.status(201).send(bundle as never);
    },
  );

  app.get(
    '/api/v2/marketplace-v2/bundles',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'List package bundles',
        response: { 200: Type.Array(BundleSchema) },
      },
    },
    async (_request, reply) => reply.send(marketplace.distributions.listBundles() as never),
  );

  app.post(
    '/api/v2/marketplace-v2/distributions',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'Create a curated distribution',
        body: Type.Object({
          name: Type.String(),
          description: Type.Optional(Type.String()),
          bundles: Type.Array(Type.Object({ bundleId: Type.String(), required: Type.Boolean() })),
          packages: Type.Array(Type.Object({ packageId: Type.String(), required: Type.Boolean(), channel: Type.Optional(Type.String()) })),
          channel: Type.String(),
          curatedBy: Type.String(),
          ai: Type.Optional(Type.Array(Type.String())),
          metadata: Type.Record(Type.String(), Type.Any()),
        }),
        response: { 201: DistributionSchema },
      },
    },
    async (request, reply) => {
      const distribution = marketplace.distributions.createDistribution(request.body as never);
      return reply.status(201).send(distribution as never);
    },
  );

  app.get(
    '/api/v2/marketplace-v2/distributions',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'List distributions',
        response: { 200: Type.Array(DistributionSchema) },
      },
    },
    async (_request, reply) => reply.send(marketplace.distributions.listDistributions() as never),
  );

  app.get(
    '/api/v2/marketplace-v2/distributions/:id/plan',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'Install plan for a distribution (required/recommended/optional/AI)',
        params: Type.Object({ id: Type.String() }),
        response: { 200: Type.Object({ required: Type.Array(Type.String()), recommended: Type.Array(Type.String()), optional: Type.Array(Type.String()), ai: Type.Array(Type.String()), total: Type.Integer() }) },
      },
    },
    async (request, reply) => reply.send(marketplace.distributions.planDistribution(request.params.id) as never),
  );

  app.post(
    '/api/v2/marketplace-v2/publishers',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'Register a publisher with a trust level',
        body: PublisherSchema,
        response: { 201: PublisherSchema },
      },
    },
    async (request, reply) => {
      marketplace.registerPublisher(request.body as never);
      return reply.status(201).send(request.body as never);
    },
  );

  app.get(
    '/api/v2/marketplace-v2/publishers',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'List registered publishers',
        response: { 200: Type.Array(PublisherSchema) },
      },
    },
    async (_request, reply) => reply.send(marketplace.publisher.listPublishers() as never),
  );

  app.post(
    '/api/v2/marketplace-v2/publish',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'Publish a package (build -> security scan -> evidence -> sign -> publish)',
        body: Type.Object({ packageId: Type.String(), version: Type.String(), kind: Type.String(), publisherId: Type.String(), buildId: Type.String(), securityScanId: Type.String(), compatibilityHash: Type.String(), channel: Type.String() }),
        response: { 200: Type.Object({ ok: Type.Boolean(), reason: Type.Optional(Type.String()), published: Type.Optional(Type.Any()) }) },
      },
    },
    async (request, reply) => {
      const result = marketplace.publisher.publish(request.body as never, 'marketplace-key');
      return reply.send(result as never);
    },
  );

  app.get(
    '/api/v2/marketplace-v2/published',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'List published packages',
        response: { 200: Type.Array(Type.Object({ packageId: Type.String(), version: Type.String(), publisherId: Type.String(), trustLevel: Type.String(), channel: Type.String(), signature: Type.String(), publishedAt: Type.String() })) },
      },
    },
    async (_request, reply) => reply.send(marketplace.publisher.listPublished() as never),
  );

  // ── MKT2-018 version/channel management ────────────────────
  app.get(
    '/api/v2/marketplace-v2/versions/:packageId',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'List versions of a package across channels',
        params: Type.Object({ packageId: Type.String() }),
        response: { 200: Type.Array(Type.Object({ packageId: Type.String(), version: Type.String(), channel: Type.String(), publishedAt: Type.String(), changelog: Type.Optional(Type.String()) })) },
      },
    },
    async (request, reply) => reply.send(marketplace.versions.listVersions(request.params.packageId) as never),
  );

  app.post(
    '/api/v2/marketplace-v2/versions',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'Publish a package version to a channel',
        body: Type.Object({ packageId: Type.String(), version: Type.String(), channel: Type.String(), changelog: Type.Optional(Type.String()) }),
        response: { 201: Type.Object({ packageId: Type.String(), version: Type.String(), channel: Type.String(), publishedAt: Type.String(), changelog: Type.Optional(Type.String()) }) },
      },
    },
    async (request, reply) => {
      const entry = marketplace.versions.publish(request.body as never);
      return reply.status(201).send(entry as never);
    },
  );

  app.post(
    '/api/v2/marketplace-v2/versions/promote',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'Promote a version between channels (e.g. beta -> stable)',
        body: Type.Object({ packageId: Type.String(), version: Type.String(), to: Type.String(), changelog: Type.Optional(Type.String()) }),
        response: { 200: Type.Object({ packageId: Type.String(), version: Type.String(), channel: Type.String(), publishedAt: Type.String(), changelog: Type.Optional(Type.String()) }) },
      },
    },
    async (request, reply) => {
      const body = request.body as { packageId: string; version: string; to: 'stable' | 'beta' | 'development' | 'canary'; changelog?: string };
      const entry = marketplace.versions.promote(body.packageId, body.version, body.to, body.changelog);
      return reply.send(entry as never);
    },
  );

  // ── MKT2-019 update policies ───────────────────────────────
  app.post(
    '/api/v2/marketplace-v2/updates/policy',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'Set an update policy for a package',
        body: Type.Object({ packageId: Type.String(), policy: Type.String(), channel: Type.String(), blockMajor: Type.Optional(Type.Boolean()) }),
        response: { 200: Type.Object({ packageId: Type.String(), policy: Type.String(), channel: Type.String(), blockMajor: Type.Optional(Type.Boolean()) }) },
      },
    },
    async (request, reply) => {
      marketplace.updates.set(request.body as never);
      return reply.send(request.body as never);
    },
  );

  app.post(
    '/api/v2/marketplace-v2/updates/evaluate',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'Evaluate whether a package should update under its policy',
        body: Type.Object({ packageId: Type.String(), currentVersion: Type.String(), latestVersion: Type.String(), channel: Type.String() }),
        response: {
          200: Type.Object({
            packageId: Type.String(),
            currentVersion: Type.String(),
            latestVersion: Type.String(),
            channel: Type.String(),
            updateAvailable: Type.Boolean(),
            breaking: Type.Boolean(),
            policy: Type.String(),
            action: Type.String(),
            reason: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { packageId: string; currentVersion: string; latestVersion: string; channel: 'stable' | 'beta' | 'development' | 'canary' };
      const policy = marketplace.updates.policyFor(body.packageId) ?? { packageId: body.packageId, policy: 'manual' as const, channel: body.channel };
      const evaluation = marketplace.updates.evaluate(body.currentVersion, body.latestVersion, body.channel, policy);
      return reply.send(evaluation as never);
    },
  );

  // ── MKT2-020 dependency impact analysis ────────────────────
  app.post(
    '/api/v2/marketplace-v2/impact',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'Analyze the impact of updating a package (reverse dependencies + capability changes)',
        body: Type.Object({ packageId: Type.String(), currentVersion: Type.String(), toVersion: Type.String(), channel: Type.String() }),
        response: {
          200: Type.Object({
            packageId: Type.String(),
            fromVersion: Type.String(),
            toVersion: Type.String(),
            breaking: Type.Boolean(),
            reverseDependencies: Type.Array(Type.Object({ dependent: Type.String(), versionRange: Type.String(), stillSatisfied: Type.Boolean() })),
            capabilitiesAdded: Type.Array(Type.String()),
            capabilitiesRemoved: Type.Array(Type.String()),
          }),
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { packageId: string; currentVersion: string; toVersion: string; channel: 'stable' | 'beta' | 'development' | 'canary' };
      const impact = marketplace.impact.analyze(body.currentVersion, { packageId: body.packageId, version: body.toVersion, channel: body.channel, publishedAt: new Date().toISOString() });
      return reply.send(impact as never);
    },
  );
};
