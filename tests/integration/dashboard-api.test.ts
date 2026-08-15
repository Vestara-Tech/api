import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createApplication } from '../../src/bootstrap/application.js';
import { loadConfig } from '../../src/config/schema.js';
import type { ProjectionService } from '../../src/dashboard/service/projection-service.js';

let app: Awaited<ReturnType<typeof buildApp>>;

beforeEach(async () => {
  const config = loadConfig({});
  const application = createApplication(config);
  app = await buildApp({ config, application });
  await app.ready();
  // Register a projection provider for the dashboard projection endpoints.
  const projections = application.container.resolve<ProjectionService>('dashboard.projections');
  projections.register({
    moduleId: 'system',
    projectionId: 'system.overview',
    fetch: async () => ({ state: 'ready', data: { healthy: true, cpu: 0.2 } }),
  });
  projections.register({
    moduleId: 'tasks',
    projectionId: 'tasks.overview',
    fetch: async () => ({ state: 'ready', data: { open: 12 } }),
  });
});

afterEach(async () => {
  await app.close();
});

describe('Dashboard control API (DASH-021)', () => {
  it('creates, validates and publishes a dashboard', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v2/dashboards',
      payload: {
        id: 'system-overview',
        name: 'System Overview',
        scope: 'system',
        layout: { columns: 12, rowHeight: 30, gap: 8, placements: [] },
        widgets: [
          { id: 'w1', type: 'system.health', configuration: {}, placement: { x: 0, y: 0, width: 4, height: 2, breakpoint: 'desktop' }, state: 'loading' },
        ],
        filters: [],
        refreshPolicy: { mode: 'interval', intervalSeconds: 30 },
      },
    });
    expect(create.statusCode).toBe(201);
    expect(create.json().revision).toBe(1);

    const validate = await app.inject({ method: 'POST', url: '/api/v2/dashboards/system-overview/validate' });
    expect(validate.json().ok).toBe(true);

    const publish = await app.inject({ method: 'POST', url: '/api/v2/dashboards/system-overview/publish' });
    expect(publish.json().publishedAt).toBeTruthy();
  });

  it('lists widgets contributed by modules', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/dashboard/widgets' });
    expect(res.statusCode).toBe(200);
    const widgets = res.json();
    expect(widgets.some((w: { type: string }) => w.type === 'system.health')).toBe(true);
    expect(widgets.some((w: { type: string }) => w.type === 'agent.active')).toBe(true);
    expect(widgets.some((w: { type: string }) => w.type === 'tasks.my-tasks')).toBe(true);

    const one = await app.inject({ method: 'GET', url: '/api/v2/dashboard/widgets/system.health' });
    expect(one.json().moduleId).toBe('system');
  });

  it('aggregates projections and fetches single projections', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v2/dashboards',
      payload: {
        id: 'agg',
        name: 'Agg',
        scope: 'system',
        layout: { columns: 12, rowHeight: 30, gap: 8, placements: [] },
        widgets: [
          { id: 'w1', type: 'system.health', configuration: {}, placement: { x: 0, y: 0, width: 4, height: 2, breakpoint: 'desktop' }, state: 'loading' },
          { id: 'w2', type: 'tasks.my-tasks', configuration: {}, placement: { x: 4, y: 0, width: 4, height: 2, breakpoint: 'desktop' }, state: 'loading' },
        ],
        filters: [],
        refreshPolicy: { mode: 'off' },
      },
    });
    expect(create.statusCode).toBe(201);

    const aggregated = await app.inject({ method: 'GET', url: '/api/v2/dashboards/agg/projection' });
    expect(aggregated.statusCode).toBe(200);
    const results = aggregated.json();
    expect(results.some((r: { projectionId: string }) => r.projectionId === 'system.overview')).toBe(true);
    expect(results.some((r: { projectionId: string }) => r.projectionId === 'tasks.overview')).toBe(true);

    const single = await app.inject({ method: 'GET', url: '/api/v2/dashboard/projections/system.overview' });
    expect(single.json().state).toBe('ready');
  });

  it('clones and removes dashboards', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v2/dashboards',
      payload: {
        id: 'orig', name: 'Original', scope: 'user',
        layout: { columns: 12, rowHeight: 30, gap: 8, placements: [] },
        widgets: [], filters: [], refreshPolicy: { mode: 'off' },
      },
    });
    expect(create.statusCode).toBe(201);

    const clone = await app.inject({ method: 'POST', url: '/api/v2/dashboards/orig/clone' });
    expect(clone.statusCode).toBe(201);
    expect(clone.json().id).not.toBe('orig');

    const del = await app.inject({ method: 'DELETE', url: '/api/v2/dashboards/orig' });
    expect(del.json().deleted).toBe(true);
  });
});
