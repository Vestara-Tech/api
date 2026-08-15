import { describe, expect, it } from 'vitest';
import {
  DashboardBuilderSession,
  DashboardBuilderService,
  DashboardGenerator,
  DashboardService,
  DashboardWidgetRegistry,
  allDashboardContributions,
  emptyDefinition,
  type DashboardDefinition,
} from '../../src/dashboard/index.js';

function platform() {
  const registry = new DashboardWidgetRegistry();
  for (const contribution of allDashboardContributions()) registry.register(contribution);
  const service = new DashboardService({ registry });
  const builder = new DashboardBuilderService({ dashboards: service, registry });
  const generator = new DashboardGenerator(registry);
  return { registry, service, builder, generator };
}

function baseDefinition(): DashboardDefinition {
  return {
    ...emptyDefinition(),
    id: 'd1',
    name: 'Base',
    revision: 1,
    scope: 'system',
  };
}

describe('DASH-BLD-001/002/003 builder session', () => {
  it('opens a blank session and edits a draft', () => {
    const session = new DashboardBuilderSession();
    expect(session.getSession().status).toBe('editing');
    const draft = session.patch({ name: 'My Dashboard' });
    expect(draft.definition.name).toBe('My Dashboard');
    expect(session.getSession().lastEditedAt).toBeTruthy();
  });

  it('opens from an existing dashboard definition', () => {
    const session = new DashboardBuilderSession(baseDefinition());
    expect(session.getDraft().baseDashboardId).toBe('d1');
  });

  it('adds, removes and places widgets on the canvas grid', () => {
    const session = new DashboardBuilderSession();
    session.addWidget({ id: 'w1', type: 'system.health', configuration: {}, placement: { x: 0, y: 0, width: 4, height: 2, breakpoint: 'desktop' }, state: 'loading' });
    expect(session.getDraft().definition.widgets).toHaveLength(1);

    session.placeWidget({ widgetId: 'w1', x: 4, y: 2, width: 8, height: 4 });
    const moved = session.getDraft().definition.widgets[0]!;
    expect(moved.placement.x).toBe(4);
    expect(moved.placement.y).toBe(2);
    expect(moved.placement.width).toBe(8);

    session.removeWidget('w1');
    expect(session.getDraft().definition.widgets).toHaveLength(0);
  });
});

describe('DASH-BLD-010/012 builder service', () => {
  it('validates and publishes a draft into the registry', () => {
    const { builder, service } = platform();
    const session = builder.open();
    session.addWidget({ id: 'w1', type: 'system.health', configuration: {}, placement: { x: 0, y: 0, width: 4, height: 2, breakpoint: 'desktop' }, state: 'loading' });
    session.patch({ id: 'built', name: 'Built', scope: 'system' });

    const published = builder.publish(session, 'built');
    expect(published.revision).toBe(1);
    expect(service.get('built').widgets).toHaveLength(1);
  });

  it('rejects publishing invalid drafts', () => {
    const { builder } = platform();
    const session = builder.open();
    session.addWidget({ id: 'w1', type: 'missing.widget', configuration: {}, placement: { x: 0, y: 0, width: 4, height: 2, breakpoint: 'desktop' }, state: 'loading' });
    session.patch({ id: 'broken', name: 'Broken', scope: 'system' });
    expect(() => builder.publish(session, 'broken')).toThrow(/Cannot publish/);
  });
});

describe('DASH-GEN-001/002/005 generator', () => {
  it('plans from available modules without hard-coded module knowledge', () => {
    const { generator } = platform();
    const plan = generator.plan({ title: 'Engineering' });
    expect(plan.sourceModuleIds).toContain('system');
    expect(plan.sourceModuleIds).toContain('tasks');
    expect(plan.widgetTypes.length).toBeGreaterThan(0);
  });

  it('generates a DashboardDefinition from the plan', () => {
    const { generator } = platform();
    const result = generator.generate({ title: 'Operations', scope: 'system', moduleIds: ['system', 'agent'] });
    expect(result.definition.name).toBe('Operations');
    expect(result.definition.widgets.length).toBeGreaterThan(0);
    expect(result.definitionHash).toBeTruthy();
    expect(result.definition.widgets.every((w) => w.state === 'loading')).toBe(true);
  });

  it('produces normal DashboardDefinitions from templates', () => {
    const { generator } = platform();
    const template = baseDefinition();
    template.widgets = [{ id: 'w1', type: 'system.health', configuration: {}, placement: { x: 0, y: 0, width: 4, height: 2, breakpoint: 'desktop' }, state: 'loading' }];
    const result = generator.fromTemplate(template);
    expect(result.definition.id).not.toBe('d1');
    expect(result.definition.name).toBe('Base');
    expect(result.definition.widgets).toHaveLength(1);
    expect(result.plan.widgetTypes).toContain('system.health');
  });
});
