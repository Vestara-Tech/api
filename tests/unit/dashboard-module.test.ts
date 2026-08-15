import { describe, expect, it } from 'vitest';
import {
  DashboardService,
  DashboardWidgetRegistry,
  ProjectionService,
  DashboardValidator,
  bumpDashboardRevision,
  systemDashboardContribution,
  allDashboardContributions,
  type DashboardDefinition,
  type WidgetInstance,
} from '../../src/dashboard/index.js';

function dashboard(overrides: Partial<DashboardDefinition> = {}): DashboardDefinition {
  return {
    id: 'd1',
    name: 'System Overview',
    scope: 'system',
    layout: { columns: 12, rowHeight: 30, gap: 8, placements: [] },
    widgets: [],
    filters: [],
    refreshPolicy: { mode: 'interval', intervalSeconds: 30 },
    revision: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function widget(id: string, type: string, overrides: Partial<WidgetInstance> = {}): WidgetInstance {
  return {
    id,
    type,
    configuration: {},
    placement: { x: 0, y: 0, width: 4, height: 2, breakpoint: 'desktop' },
    state: 'loading',
    ...overrides,
  };
}

function serviceWith(permissions: readonly string[] = []) {
  const registry = new DashboardWidgetRegistry();
  for (const contribution of allDashboardContributions()) registry.register(contribution);
  return new DashboardService({ registry, currentPermissions: () => permissions });
}

describe('DASH-007 widget registry', () => {
  it('registers module contributions and lists widgets', () => {
    const registry = new DashboardWidgetRegistry();
    registry.register(systemDashboardContribution());
    expect(registry.listWidgets().length).toBeGreaterThanOrEqual(2);
    expect(registry.getWidget('system.health').moduleId).toBe('system');
    expect(registry.listModules()).toContain('system');
  });

  it('unregisters module widgets when a module is disabled', () => {
    const registry = new DashboardWidgetRegistry();
    registry.register(systemDashboardContribution());
    registry.unregister('system');
    expect(registry.listWidgets()).toHaveLength(0);
    expect(() => registry.getWidget('system.health')).toThrow(/not found/);
  });

  it('honors module lifecycle in listings', () => {
    const registry = new DashboardWidgetRegistry({ lifecycle: { isEnabled: (m) => m !== 'system' } });
    registry.register(systemDashboardContribution());
    registry.register(allDashboardContributions()[2]!); // agent
    expect(registry.listWidgets().every((w) => w.moduleId !== 'system')).toBe(true);
    expect(registry.listWidgets().some((w) => w.moduleId === 'agent')).toBe(true);
  });
});

describe('DASH-010/011 dashboard service + permission filtering', () => {
  it('creates, updates, clones and resets dashboards', () => {
    const service = serviceWith(['system.read']);
    const created = service.create(dashboard({ widgets: [widget('w1', 'system.health')] }));
    expect(created.revision).toBe(1);

    const updated = service.update('d1', { name: 'Renamed' });
    expect(updated.revision).toBe(2);

    const cloned = service.clone('d1');
    expect(cloned.id).not.toBe('d1');
    expect(cloned.revision).toBe(1);

    const reset = service.reset('d1');
    expect(reset.revision).toBe(1);
  });

  it('filters widgets by permissions (DASH-011)', () => {
    const service = serviceWith([]);
    const definition = dashboard({
      widgets: [
        widget('w1', 'system.health'),          // requires system.read
        widget('w2', 'notification.recent'),    // no permissions
      ],
    });
    service.create(definition);
    const visible = service.visibleWidgets('d1');
    expect(visible.widgets.map((w) => w.id)).toEqual(['w2']);
  });

  it('adds, updates and removes widgets', () => {
    const service = serviceWith(['system.read']);
    service.create(dashboard());
    service.addWidget('d1', widget('w1', 'system.health'));
    expect(service.get('d1').widgets).toHaveLength(1);

    service.updateWidget('d1', 'w1', { title: 'Sys Health' });
    expect(service.get('d1').widgets[0]!.title).toBe('Sys Health');

    service.removeWidget('d1', 'w1');
    expect(service.get('d1').widgets).toHaveLength(0);
  });

  it('rejects invalid dashboards', () => {
    const service = serviceWith([]);
    expect(() => service.create(dashboard({ widgets: [widget('w1', 'nonexistent.widget')] }))).toThrow(/Invalid dashboard/);
  });
});

describe('DASH-019/020 validation + publish', () => {
  it('validates widget types and placements', () => {
    const registry = new DashboardWidgetRegistry();
    registry.register(systemDashboardContribution());
    const validator = new DashboardValidator(registry);
    const valid = validator.validate(dashboard({ widgets: [widget('w1', 'system.health')] }), ['system.read']);
    expect(valid.ok).toBe(true);

    const badPlacement = validator.validate(dashboard({ widgets: [widget('w1', 'system.health', { placement: { x: 10, y: 0, width: 8, height: 2, breakpoint: 'desktop' } })] }), ['system.read']);
    expect(badPlacement.ok).toBe(false);
    expect(badPlacement.issues.some((i) => i.message.includes('exceeds layout columns'))).toBe(true);
  });

  it('bumps revisions and publishes freeze a revision', () => {
    const service = serviceWith(['system.read']);
    const created = service.create(dashboard({ widgets: [widget('w1', 'system.health')] }));
    const bumped = bumpDashboardRevision(created);
    expect(bumped.revision).toBe(2);

    const published = service.publish('d1');
    expect(published.publishedAt).toBeTruthy();
  });
});

describe('DASH-015/016/017 projection service', () => {
  it('aggregates projections concurrently with isolation', async () => {
    const projections = new ProjectionService({ timeoutMs: 100 });
    projections.register({
      moduleId: 'system',
      projectionId: 'system.overview',
      fetch: async () => ({ state: 'ready', data: { healthy: true } }),
    });
    projections.register({
      moduleId: 'tasks',
      projectionId: 'tasks.overview',
      fetch: async () => ({ state: 'ready', data: { open: 12 } }),
    });
    const results = await projections.aggregate(['system.overview', 'tasks.overview']);
    expect(results).toHaveLength(2);
    expect(results[0]!.state).toBe('ready');
    expect(results[1]!.state).toBe('ready');
  });

  it('isolates a broken provider (no dashboard 500)', async () => {
    const projections = new ProjectionService({ timeoutMs: 50 });
    projections.register({
      moduleId: 'system',
      projectionId: 'system.overview',
      fetch: async () => ({ state: 'ready', data: { healthy: true } }),
    });
    projections.register({
      moduleId: 'database',
      projectionId: 'database.overview',
      fetch: async () => {
        throw new Error('database offline');
      },
    });
    const results = await projections.aggregate(['system.overview', 'database.overview']);
    expect(results[0]!.state).toBe('ready');
    expect(results[1]!.state).toBe('error');
    expect(results[1]!.error).toContain('database offline');
  });

  it('times out slow providers and serves stale cache', async () => {
    const projections = new ProjectionService({ timeoutMs: 30, cacheMs: 1 });
    projections.register({
      moduleId: 'agent',
      projectionId: 'agent.overview',
      fetch: async () => ({ state: 'ready', data: { active: 4 } }),
    });
    await projections.fetch('agent.overview');
    await new Promise((r) => setTimeout(r, 5));

    // Replace with a hanging provider; the cached result should be served stale.
    projections.register({
      moduleId: 'agent',
      projectionId: 'agent.overview',
      fetch: () => new Promise(() => undefined),
    });
    const result = await projections.fetch('agent.overview');
    expect(result.stale).toBe(true);
    expect(result.data).toEqual({ active: 4 });
  });

  it('returns module-disabled for unknown projections', async () => {
    const projections = new ProjectionService();
    const result = await projections.fetch('missing.projection');
    expect(result.state).toBe('module-disabled');
  });
});
