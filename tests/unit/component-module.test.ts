import { describe, expect, it } from 'vitest';
import { ComponentRegistry, ComponentTreeValidator, ComponentService, builtinComponents, type ComponentInstance } from '../../src/component/index.js';

function registryWith(capabilities: string[] = []) {
  const registry = new ComponentRegistry({ resolveCapability: (cap) => capabilities.includes(cap) });
  for (const component of builtinComponents()) registry.register(component);
  return registry;
}

describe('COMP-003 component registry', () => {
  it('registers and resolves built-in components', () => {
    const registry = registryWith();
    expect(registry.list().length).toBeGreaterThanOrEqual(7);
    const button = registry.resolve('button');
    expect(button.category).toBe('primitive');
    expect(button.renderer.kind).toBe('react');
  });

  it('categorizes and searches', () => {
    const registry = registryWith();
    expect(registry.categories().map((c) => c.name)).toContain('primitive');
    expect(registry.search('grid')).toHaveLength(1);
    expect(registry.versions('button')).toContain('1.0.0');
    expect(registry.listByCategory('layout')).toHaveLength(1);
  });
});

describe('COMP-011 capability resolution', () => {
  it('reports availability based on required capabilities', () => {
    const registry = registryWith([]);
    const dataGrid = registry.availability('data-grid');
    expect(dataGrid.available).toBe(false);
    expect(dataGrid.missing).toContain('database.read');

    const withCap = registryWith(['database.read']);
    expect(withCap.availability('data-grid').available).toBe(true);
  });

  it('system-health requires system.read + diagnostics.read', () => {
    const registry = registryWith(['system.read', 'diagnostics.read']);
    const availability = registry.availability('system-health');
    expect(availability.available).toBe(true);
  });
});

describe('COMP-010 component tree validator', () => {
  const registry = registryWith(['database.read', 'agent.read', 'system.read', 'diagnostics.read']);
  const validator = new ComponentTreeValidator(registry);

  function instance(id: string, overrides: Partial<ComponentInstance> = {}): ComponentInstance {
    return { id: `node_${id}`, definitionId: id, definitionVersion: '1.0.0', properties: {}, bindings: [], eventBindings: [], slots: {}, ...overrides };
  }

  it('validates a well-formed tree', () => {
    const tree = {
      id: 't1',
      name: 'Home',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      root: instance('card', {
        slots: { header: [instance('text', { properties: { content: 'Title' } })], content: [instance('button', { properties: { label: 'Go', variant: 'primary' } })] },
      }),
    };
    const result = validator.validate(tree);
    expect(result.ok).toBe(true);
    expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('rejects unknown components and slot mismatches', () => {
    const tree = {
      id: 't2',
      name: 'Broken',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      root: instance('card', {
        slots: { header: [instance('missing-component')], content: [instance('data-grid')] },
      }),
    };
    const result = validator.validate(tree);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes('unknown component'))).toBe(true);
  });

  it('rejects invalid enum property values', () => {
    const tree = {
      id: 't3',
      name: 'Enum',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      root: instance('button', { properties: { label: 'x', variant: 'not-a-variant' } }),
    };
    const result = validator.validate(tree);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes('invalid enum value'))).toBe(true);
  });

  it('rejects invalid visibility expressions', () => {
    const tree = {
      id: 't4',
      name: 'Vis',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      root: instance('text', { properties: { content: 'x' }, visibility: { expression: 'a && (' } }),
    };
    const result = validator.validate(tree);
    expect(result.ok).toBe(false);
  });
});

describe('COMP-013 component service', () => {
  it('edits a published component by creating a new draft version (immutable published)', () => {
    const service = new ComponentService({ registry: registryWith() });
    const published = service.register({ ...builtinComponents()[0]!, id: 'custom-button', name: 'custom-button', displayName: 'Custom Button' });
    const draft = service.createNextVersion(published, '2.0.0');
    expect(draft.version).toBe('2.0.0');
    expect(draft.status).toBe('draft');
    expect(service.validateComponent('custom-button').ok).toBe(true);
    // published original is untouched
    expect(service.validateComponent('button').ok).toBe(true);
  });

  it('manages component trees with validation', () => {
    const service = new ComponentService({ registry: registryWith(['database.read', 'agent.read', 'system.read', 'diagnostics.read']) });
    const tree = service.createTree({
      id: 'tree_1',
      name: 'Dashboard',
      root: { id: 'n1', definitionId: 'card', definitionVersion: '1.0.0', properties: {}, bindings: [], eventBindings: [], slots: {} },
    });
    expect(service.getTree('tree_1').name).toBe('Dashboard');
    expect(service.listTrees()).toHaveLength(1);
    expect(service.validateTree('tree_1').ok).toBe(true);
  });
});
