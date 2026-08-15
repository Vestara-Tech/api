import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { ComponentService } from '../component/service/component-service.js';
import type { ComponentRegistry } from '../component/registry/component-registry.js';

const ComponentViewSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  displayName: Type.String(),
  version: Type.String(),
  category: Type.String(),
  status: Type.String(),
  capabilities: Type.Array(Type.String()),
  slots: Type.Array(Type.Object({ name: Type.String() })),
  events: Type.Array(Type.Object({ name: Type.String(), kind: Type.String() })),
});

const RegisterBodySchema = Type.Object({
  id: Type.String(),
  packageId: Type.String(),
  name: Type.String(),
  displayName: Type.String(),
  version: Type.String(),
  category: Type.String(),
  renderer: Type.Object({ kind: Type.String() }),
  properties: Type.Array(Type.Object({ name: Type.String(), type: Type.String() })),
  slots: Type.Array(Type.Object({ name: Type.String() })),
  events: Type.Array(Type.Object({ name: Type.String(), kind: Type.String() })),
  actions: Type.Array(Type.Object({ id: Type.String(), name: Type.String(), kind: Type.String() })),
  capabilities: Type.Array(Type.String()),
  permissions: Type.Array(Type.String()),
  designTokens: Type.Array(Type.String()),
  status: Type.String(),
  metadata: Type.Record(Type.String(), Type.Any()),
});

const TreeSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  root: Type.Any(),
});

/**
 * COMP-021 — Component control API. Registry, search, categories, versions,
 * availability (capability resolution), component trees + validation.
 */
export const componentRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const service = app.application.container.resolve<ComponentService>('component.service');
  const registry = app.application.container.resolve<ComponentRegistry>('component.registry');

  app.get(
    '/api/v2/components',
    {
      schema: {
        tags: ['components'],
        summary: 'List registered components',
        response: { 200: Type.Array(ComponentViewSchema) },
      },
    },
    async (_request, reply) => reply.send(registry.list().map(toView) as never),
  );

  app.get(
    '/api/v2/components/:id',
    {
      schema: {
        tags: ['components'],
        summary: 'Get a component definition',
        params: Type.Object({ id: Type.String() }),
        response: { 200: ComponentViewSchema },
      },
    },
    async (request, reply) => reply.send(toView(registry.resolve(request.params.id)) as never),
  );

  app.post(
    '/api/v2/components',
    {
      schema: {
        tags: ['components'],
        summary: 'Register a component definition (module/marketplace contribution)',
        body: RegisterBodySchema,
        response: { 201: ComponentViewSchema },
      },
    },
    async (request, reply) => reply.status(201).send(toView(service.register(request.body as never)) as never),
  );

  app.get(
    '/api/v2/components/categories',
    {
      schema: {
        tags: ['components'],
        summary: 'Component categories with counts',
        response: { 200: Type.Array(Type.Object({ name: Type.String(), count: Type.Integer() })) },
      },
    },
    async (_request, reply) => reply.send(registry.categories() as never),
  );

  app.get(
    '/api/v2/components/search',
    {
      schema: {
        tags: ['components'],
        summary: 'Search components',
        querystring: Type.Object({ q: Type.Optional(Type.String()) }),
        response: { 200: Type.Array(ComponentViewSchema) },
      },
    },
    async (request, reply) => reply.send(registry.search(request.query.q).map(toView) as never),
  );

  app.get(
    '/api/v2/components/:id/versions',
    {
      schema: {
        tags: ['components'],
        summary: 'Component version history',
        params: Type.Object({ id: Type.String() }),
        response: { 200: Type.Array(Type.String()) },
      },
    },
    async (request, reply) => reply.send(registry.versions(request.params.id) as never),
  );

  app.get(
    '/api/v2/components/:id/availability',
    {
      schema: {
        tags: ['components'],
        summary: 'Component availability (capability resolution)',
        params: Type.Object({ id: Type.String() }),
        response: { 200: Type.Object({ available: Type.Boolean(), missing: Type.Array(Type.String()) }) },
      },
    },
    async (request, reply) => reply.send(registry.availability(request.params.id) as never),
  );

  app.post(
    '/api/v2/components/trees',
    {
      schema: {
        tags: ['components'],
        summary: 'Create a component tree',
        body: TreeSchema,
        response: { 201: TreeSchema },
      },
    },
    async (request, reply) => reply.status(201).send(service.createTree(request.body as never) as never),
  );

  app.get(
    '/api/v2/components/trees',
    {
      schema: {
        tags: ['components'],
        summary: 'List component trees',
        response: { 200: Type.Array(Type.Object({ id: Type.String(), name: Type.String() })) },
      },
    },
    async (_request, reply) => reply.send(service.listTrees().map((t) => ({ id: t.id, name: t.name })) as never),
  );

  app.post(
    '/api/v2/components/trees/:id/validate',
    {
      schema: {
        tags: ['components'],
        summary: 'Validate a component tree (slot + property constraints)',
        params: Type.Object({ id: Type.String() }),
        response: { 200: Type.Object({ ok: Type.Boolean(), issues: Type.Array(Type.Object({ path: Type.String(), message: Type.String(), severity: Type.String() })) }) },
      },
    },
    async (request, reply) => reply.send(service.validateTree(request.params.id) as never),
  );
};

function toView(c: {
  id: string; name: string; displayName: string; version: string; category: string; status: string;
  capabilities: readonly string[]; slots: readonly { name: string }[]; events: readonly { name: string; kind: string }[];
}) {
  return { id: c.id, name: c.name, displayName: c.displayName, version: c.version, category: c.category, status: c.status, capabilities: c.capabilities, slots: c.slots, events: c.events };
}
