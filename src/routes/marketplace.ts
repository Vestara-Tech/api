import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { MarketplaceCatalogService } from '../marketplace/catalog/catalog-service.js';
import type { LocalPackageRegistry } from '../marketplace/registry/local-package-registry.js';
import type { InstallationService } from '../marketplace/installation/installation-service.js';
import type { PackageLifecycleService } from '../marketplace/lifecycle/package-lifecycle-service.js';
import type { MarketplaceContributionRegistry } from '../marketplace/contribution/contribution-registry.js';

const PackageViewSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  version: Type.String(),
  kind: Type.String(),
  publisher: Type.String(),
  description: Type.Optional(Type.String()),
  installs: Type.Optional(Type.Integer()),
  rating: Type.Optional(Type.Number()),
});

const PackageDetailSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  version: Type.String(),
  kind: Type.String(),
  publisher: Type.Object({ id: Type.String(), name: Type.String(), verified: Type.Boolean() }),
  description: Type.Optional(Type.String()),
  dependencies: Type.Array(Type.Object({ packageId: Type.String(), versionRange: Type.String(), required: Type.Boolean() })),
  permissions: Type.Array(Type.Object({ id: Type.String(), required: Type.Boolean(), approval: Type.Optional(Type.String()) })),
  capabilities: Type.Array(Type.Object({ id: Type.String(), name: Type.String() })),
  compatibility: Type.Object({ apiRange: Type.Optional(Type.String()), platformRange: Type.Optional(Type.String()) }),
  provenance: Type.Object({ source: Type.String(), verified: Type.Boolean(), publishedAt: Type.String() }),
  installs: Type.Optional(Type.Integer()),
  rating: Type.Optional(Type.Number()),
});

const InstallBodySchema = Type.Object({
  packageId: Type.String(),
  approved: Type.Optional(Type.Boolean()),
  principalId: Type.Optional(Type.String()),
});

const ApiErrorSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    requestId: Type.String(),
    correlationId: Type.String(),
    retryable: Type.Boolean(),
    details: Type.Optional(Type.Any()),
  }),
});

/**
 * MKT-023 — Marketplace control API. Discovery + governed install/lifecycle.
 * Marketplace UI consumes this; it never owns installation logic.
 */
export const marketplaceRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const catalog = app.application.container.resolve<MarketplaceCatalogService>('marketplace.catalog');
  const registry = app.application.container.resolve<LocalPackageRegistry>('marketplace.registry');
  const installer = app.application.container.resolve<InstallationService>('marketplace.installer');
  const lifecycle = app.application.container.resolve<PackageLifecycleService>('marketplace.lifecycle');

  app.get(
    '/api/v2/marketplace/packages',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'List packages (searchable/filterable)',
        querystring: Type.Object({
          search: Type.Optional(Type.String()),
          kind: Type.Optional(Type.String()),
          installed: Type.Optional(Type.String()),
        }),
        response: { 200: Type.Array(PackageViewSchema) },
      },
    },
    async (request, reply) => {
      const items = catalog.search({
        ...(request.query.search !== undefined ? { search: request.query.search } : {}),
        ...(request.query.kind !== undefined ? { kind: request.query.kind as never } : {}),
        ...(request.query.installed !== undefined ? { installed: request.query.installed === 'true' } : {}),
      });
      return reply.send(items.map(toView) as never);
    },
  );

  app.get(
    '/api/v2/marketplace/packages/:id',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'Get a package (permissions, dependencies, compatibility)',
        params: Type.Object({ id: Type.String() }),
        response: { 200: PackageDetailSchema, 404: ApiErrorSchema },
      },
    },
    async (request, reply) => {
      try {
        const pkg = catalog.get(request.params.id);
        return reply.send(toDetail(pkg) as never);
      } catch {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: `Package "${request.params.id}" not found`, requestId: request.id, correlationId: 'marketplace', retryable: false } } as never);
      }
    },
  );

  app.get(
    '/api/v2/marketplace/categories',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'Package categories with counts',
        response: { 200: Type.Array(Type.Object({ name: Type.String(), count: Type.Integer() })) },
      },
    },
    async (_request, reply) => reply.send(catalog.categories() as never),
  );

  app.get(
    '/api/v2/marketplace/installed',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'Installed packages',
        response: {
          200: Type.Array(
            Type.Object({
              packageId: Type.String(),
              version: Type.String(),
              status: Type.String(),
              enabled: Type.Boolean(),
              installedAt: Type.String(),
              knownGoodVersion: Type.Optional(Type.String()),
            }),
          ),
        },
      },
    },
    async (_request, reply) => reply.send(registry.listInstalled() as never),
  );

  app.post(
    '/api/v2/marketplace/install',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'Governed install (review + approval gate)',
        body: InstallBodySchema,
        response: { 200: Type.Object({ packageId: Type.String(), version: Type.String(), status: Type.String(), operationId: Type.String() }), 409: ApiErrorSchema, 400: ApiErrorSchema },
      },
    },
    async (request, reply) => {
      try {
        const result = installer.install(request.body as never);
        return reply.send(result as never);
      } catch (err) {
        const message = (err as Error).message;
        if (message.includes('requires approval')) {
          return reply.status(409).send({ error: { code: 'APPROVAL_REQUIRED', message, requestId: request.id, correlationId: 'marketplace', retryable: false } } as never);
        }
        return reply.status(400).send({ error: { code: 'BAD_REQUEST', message, requestId: request.id, correlationId: 'marketplace', retryable: false } } as never);
      }
    },
  );

  app.post(
    '/api/v2/marketplace/packages/:id/enable',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'Enable an installed package',
        params: Type.Object({ id: Type.String() }),
        response: { 200: PackageViewSchema, 400: ApiErrorSchema },
      },
    },
    async (request, reply) => reply.send(toView(lifecycle.enable(request.params.id)) as never),
  );

  app.post(
    '/api/v2/marketplace/packages/:id/disable',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'Disable an installed package',
        params: Type.Object({ id: Type.String() }),
        response: { 200: PackageViewSchema, 400: ApiErrorSchema },
      },
    },
    async (request, reply) => reply.send(toView(lifecycle.disable(request.params.id)) as never),
  );

  app.delete(
    '/api/v2/marketplace/packages/:id',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'Uninstall a package',
        params: Type.Object({ id: Type.String() }),
        response: { 204: Type.Null(), 400: ApiErrorSchema },
      },
    },
    async (request, reply) => {
      lifecycle.uninstall(request.params.id);
      return reply.status(204).send(null);
    },
  );

  app.post(
    '/api/v2/marketplace/packages/:id/update',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'Update to the latest available version',
        params: Type.Object({ id: Type.String() }),
        response: { 200: Type.Object({ from: Type.String(), to: Type.String(), status: Type.String() }), 400: ApiErrorSchema },
      },
    },
    async (request, reply) => reply.send(lifecycle.update(request.params.id) as never),
  );

  app.post(
    '/api/v2/marketplace/packages/:id/rollback',
    {
      schema: {
        tags: ['marketplace'],
        summary: 'Roll back to the known-good version',
        params: Type.Object({ id: Type.String() }),
        response: { 200: Type.Object({ from: Type.String(), to: Type.String() }), 400: ApiErrorSchema },
      },
    },
    async (request, reply) => reply.send(lifecycle.rollback(request.params.id) as never),
  );
};

function toView(pkg: { id: string; name: string; version: string; kind: string; publisher: { id: string; name: string; verified: boolean }; manifest?: { description?: string }; description?: string; installs?: number; rating?: number }) {
  const description = pkg.manifest?.description ?? pkg.description;
  return {
    id: pkg.id,
    name: pkg.name,
    version: pkg.version,
    kind: pkg.kind,
    publisher: pkg.publisher.name,
    ...(description !== undefined ? { description } : {}),
    ...(pkg.installs !== undefined ? { installs: pkg.installs } : {}),
    ...(pkg.rating !== undefined ? { rating: pkg.rating } : {}),
  };
}

function toDetail(pkg: {
  id: string; name: string; version: string; kind: string;
  publisher: { id: string; name: string; verified: boolean };
  manifest?: { description?: string };
  description?: string;
  dependencies: readonly { packageId: string; versionRange: string; required: boolean }[];
  permissions: readonly { id: string; required: boolean; approval?: string }[];
  capabilities: readonly { id: string; name: string }[];
  compatibility: { apiRange?: string; platformRange?: string };
  provenance: { source: string; verified: boolean; publishedAt: string };
  installs?: number; rating?: number;
}) {
  const description = pkg.manifest?.description ?? pkg.description;
  return {
    id: pkg.id,
    name: pkg.name,
    version: pkg.version,
    kind: pkg.kind,
    publisher: { id: pkg.publisher.id, name: pkg.publisher.name, verified: pkg.publisher.verified },
    ...(description !== undefined ? { description } : {}),
    dependencies: pkg.dependencies,
    permissions: pkg.permissions,
    capabilities: pkg.capabilities,
    compatibility: {
      ...(pkg.compatibility.apiRange !== undefined ? { apiRange: pkg.compatibility.apiRange } : {}),
      ...(pkg.compatibility.platformRange !== undefined ? { platformRange: pkg.compatibility.platformRange } : {}),
    },
    provenance: pkg.provenance,
    ...(pkg.installs !== undefined ? { installs: pkg.installs } : {}),
    ...(pkg.rating !== undefined ? { rating: pkg.rating } : {}),
  };
}
