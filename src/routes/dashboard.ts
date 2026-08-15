import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { DashboardService } from '../dashboard/service/dashboard-service.js';
import type { DashboardWidgetRegistry } from '../dashboard/registry/widget-registry.js';
import type { ProjectionService } from '../dashboard/service/projection-service.js';
import type { DashboardBuilderService } from '../dashboard/builder/dashboard-builder-service.js';
import type { DashboardGenerator } from '../dashboard/builder/dashboard-generator.js';

const WidgetInstanceSchema = Type.Object({
  id: Type.String(),
  type: Type.String(),
  title: Type.Optional(Type.String()),
  configuration: Type.Record(Type.String(), Type.Any()),
  placement: Type.Object({ x: Type.Integer(), y: Type.Integer(), width: Type.Integer(), height: Type.Integer(), breakpoint: Type.String() }),
  refreshIntervalSeconds: Type.Optional(Type.Integer()),
  state: Type.String(),
  lastUpdatedAt: Type.Optional(Type.String()),
  error: Type.Optional(Type.String()),
});

const DashboardSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  description: Type.Optional(Type.String()),
  scope: Type.String(),
  layout: Type.Object({ columns: Type.Integer(), rowHeight: Type.Integer(), gap: Type.Integer(), placements: Type.Array(Type.Any()) }),
  widgets: Type.Array(WidgetInstanceSchema),
  filters: Type.Array(Type.Any()),
  refreshPolicy: Type.Object({ mode: Type.String(), intervalSeconds: Type.Optional(Type.Integer()) }),
  ownerUserId: Type.Optional(Type.String()),
  revision: Type.Integer(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
  publishedAt: Type.Optional(Type.String()),
});

const WidgetDefinitionSchema = Type.Object({
  type: Type.String(),
  moduleId: Type.String(),
  title: Type.String(),
  description: Type.Optional(Type.String()),
  defaultSize: Type.Object({ minWidth: Type.Integer(), minHeight: Type.Integer() }),
  dataSource: Type.Object({ type: Type.String(), moduleId: Type.Optional(Type.String()), projection: Type.Optional(Type.String()) }),
  permissions: Type.Array(Type.String()),
  configurable: Type.Boolean(),
  refreshIntervalSeconds: Type.Optional(Type.Integer()),
});

const ProjectionResultSchema = Type.Object({
  projectionId: Type.String(),
  moduleId: Type.String(),
  state: Type.String(),
  data: Type.Optional(Type.Any()),
  error: Type.Optional(Type.String()),
  durationMs: Type.Optional(Type.Integer()),
  cachedAt: Type.Optional(Type.String()),
  stale: Type.Optional(Type.Boolean()),
});

/**
 * DASH-021 — Dashboard control API. Presentation/composition/layout only;
 * source modules keep owning their state. Projections aggregate read-models
 * through providers with isolation.
 */
export const dashboardRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const dashboard = app.application.container.resolve<DashboardService>('dashboard.service');
  const registry = app.application.container.resolve<DashboardWidgetRegistry>('dashboard.registry');
  const projections = app.application.container.resolve<ProjectionService>('dashboard.projections');
  const builder = app.application.container.resolve<DashboardBuilderService>('dashboard.builder');
  const generator = app.application.container.resolve<DashboardGenerator>('dashboard.generator');

  app.get(
    '/api/v2/dashboards',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'List dashboards',
        response: { 200: Type.Array(DashboardSchema) },
      },
    },
    async (_request, reply) => reply.send(dashboard.list() as never),
  );

  app.post(
    '/api/v2/dashboards',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Create a dashboard (declarative definition)',
        body: Type.Object({
          id: Type.String(),
          name: Type.String(),
          description: Type.Optional(Type.String()),
          scope: Type.String(),
          layout: Type.Object({ columns: Type.Integer(), rowHeight: Type.Integer(), gap: Type.Integer(), placements: Type.Array(Type.Any()) }),
          widgets: Type.Array(WidgetInstanceSchema),
          filters: Type.Array(Type.Any()),
          refreshPolicy: Type.Object({ mode: Type.String(), intervalSeconds: Type.Optional(Type.Integer()) }),
          ownerUserId: Type.Optional(Type.String()),
        }),
        response: { 201: DashboardSchema },
      },
    },
    async (request, reply) => reply.status(201).send(dashboard.create(request.body as never) as never),
  );

  app.get(
    '/api/v2/dashboards/:id',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Get a dashboard (permission-filtered widgets)',
        params: Type.Object({ id: Type.String() }),
        response: { 200: DashboardSchema },
      },
    },
    async (request, reply) => reply.send(dashboard.visibleWidgets(request.params.id) as never),
  );

  app.patch(
    '/api/v2/dashboards/:id',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Update a dashboard (bumps revision, validates)',
        params: Type.Object({ id: Type.String() }),
        body: Type.Any(),
        response: { 200: DashboardSchema },
      },
    },
    async (request, reply) => reply.send(dashboard.update(request.params.id, request.body as never) as never),
  );

  app.delete(
    '/api/v2/dashboards/:id',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Delete a dashboard',
        params: Type.Object({ id: Type.String() }),
        response: { 200: Type.Object({ deleted: Type.Boolean() }) },
      },
    },
    async (request, reply) => {
      dashboard.remove(request.params.id);
      return reply.send({ deleted: true } as never);
    },
  );

  app.post(
    '/api/v2/dashboards/:id/clone',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Clone a dashboard (new id, revision 1)',
        params: Type.Object({ id: Type.String() }),
        response: { 201: DashboardSchema },
      },
    },
    async (request, reply) => reply.status(201).send(dashboard.clone(request.params.id) as never),
  );

  app.post(
    '/api/v2/dashboards/:id/reset',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Reset a dashboard to revision 1',
        params: Type.Object({ id: Type.String() }),
        response: { 200: DashboardSchema },
      },
    },
    async (request, reply) => reply.send(dashboard.reset(request.params.id) as never),
  );

  app.post(
    '/api/v2/dashboards/:id/validate',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Validate a dashboard (widgets, layout, permissions)',
        params: Type.Object({ id: Type.String() }),
        response: { 200: Type.Object({ ok: Type.Boolean(), issues: Type.Array(Type.Object({ path: Type.String(), message: Type.String(), severity: Type.String() })) }) },
      },
    },
    async (request, reply) => reply.send(dashboard.validate(dashboard.get(request.params.id)) as never),
  );

  app.post(
    '/api/v2/dashboards/:id/publish',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Publish a dashboard (freezes revision)',
        params: Type.Object({ id: Type.String() }),
        response: { 200: DashboardSchema },
      },
    },
    async (request, reply) => reply.send(dashboard.publish(request.params.id) as never),
  );

  app.get(
    '/api/v2/dashboard/widgets',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'List available widgets (module lifecycle honored)',
        response: { 200: Type.Array(WidgetDefinitionSchema) },
      },
    },
    async (_request, reply) => reply.send(registry.listWidgets() as never),
  );

  app.get(
    '/api/v2/dashboard/widgets/:type',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Get a widget definition',
        params: Type.Object({ type: Type.String() }),
        response: { 200: WidgetDefinitionSchema },
      },
    },
    async (request, reply) => reply.send(registry.getWidget(request.params.type) as never),
  );

  app.post(
    '/api/v2/dashboards/:id/widgets',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Add a widget to a dashboard',
        params: Type.Object({ id: Type.String() }),
        body: WidgetInstanceSchema,
        response: { 200: DashboardSchema },
      },
    },
    async (request, reply) => {
      const { id, ...rest } = request.body as { id: string } & Record<string, unknown>;
      return reply.send(dashboard.addWidget(request.params.id, rest as never) as never);
    },
  );

  app.patch(
    '/api/v2/dashboards/:id/widgets/:widgetId',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Update a widget on a dashboard',
        params: Type.Object({ id: Type.String(), widgetId: Type.String() }),
        body: Type.Any(),
        response: { 200: DashboardSchema },
      },
    },
    async (request, reply) => reply.send(dashboard.updateWidget(request.params.id, request.params.widgetId, request.body as never) as never),
  );

  app.delete(
    '/api/v2/dashboards/:id/widgets/:widgetId',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Remove a widget from a dashboard',
        params: Type.Object({ id: Type.String(), widgetId: Type.String() }),
        response: { 200: DashboardSchema },
      },
    },
    async (request, reply) => reply.send(dashboard.removeWidget(request.params.id, request.params.widgetId) as never),
  );

  app.get(
    '/api/v2/dashboards/:id/projection',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Aggregate projections for a dashboard',
        params: Type.Object({ id: Type.String() }),
        response: { 200: Type.Array(ProjectionResultSchema) },
      },
    },
    async (request, reply) => {
      const definition = dashboard.get(request.params.id);
      const ids = definition.widgets.map((w) => projectionIdFor(w.type, registry));
      const results = await projections.aggregate(ids);
      return reply.send(results as never);
    },
  );

  app.get(
    '/api/v2/dashboard/projections/:projection',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Fetch a single projection (isolated provider)',
        params: Type.Object({ projection: Type.String() }),
        response: { 200: ProjectionResultSchema },
      },
    },
    async (request, reply) => reply.send((await projections.fetch(request.params.projection)) as never),
  );

  // ── DASH-BLD builder + DASH-GEN generator ──────────────────
  const GenerationResultSchema = Type.Object({
    plan: Type.Object({ planId: Type.String(), title: Type.String(), scope: Type.String(), widgetTypes: Type.Array(Type.String()), sourceModuleIds: Type.Array(Type.String()) }),
    definition: DashboardSchema,
    definitionHash: Type.String(),
  });

  app.post(
    '/api/v2/dashboard/generate',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Generate a dashboard from available modules/widgets',
        body: Type.Object({
          title: Type.Optional(Type.String()),
          scope: Type.Optional(Type.String()),
          description: Type.Optional(Type.String()),
          moduleIds: Type.Optional(Type.Array(Type.String())),
          widgetTypes: Type.Optional(Type.Array(Type.String())),
          layoutColumns: Type.Optional(Type.Integer()),
        }),
        response: { 200: GenerationResultSchema },
      },
    },
    async (request, reply) => reply.send(generator.generate(request.body as never) as never),
  );

  app.post(
    '/api/v2/dashboard/builder/open',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Open a builder session (from a dashboard or blank)',
        body: Type.Object({ baseDashboardId: Type.Optional(Type.String()) }),
        response: { 200: Type.Object({ sessionId: Type.String(), draftId: Type.String(), status: Type.String(), definition: DashboardSchema }) },
      },
    },
    async (request, reply) => {
      const session = builder.open(request.body.baseDashboardId);
      return reply.send({ sessionId: session.getSession().sessionId, draftId: session.getSession().draftId, status: session.getSession().status, definition: session.getDraft().definition } as never);
    },
  );

  app.post(
    '/api/v2/dashboard/builder/publish',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Publish a builder draft into the dashboard registry',
        body: Type.Object({ id: Type.Optional(Type.String()), definition: DashboardSchema }),
        response: { 200: DashboardSchema },
      },
    },
    async (request, reply) => {
      const body = request.body as { id?: string; definition: { id: string } & Record<string, unknown> };
      const session = builder.open(body.definition.id);
      session.patch(body.definition);
      return reply.send(builder.publish(session, body.id ?? body.definition.id) as never);
    },
  );
};

function projectionIdFor(widgetType: string, registry: DashboardWidgetRegistry): string {
  try {
    const definition = registry.getWidget(widgetType);
    return definition.dataSource.projection ?? widgetType;
  } catch {
    return widgetType;
  }
}
