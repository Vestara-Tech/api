import { describe, expect, it } from 'vitest';
import { CapabilityRegistry } from '../../../src/capabilities/registry.js';
import { ExecutionServiceImpl } from '../../../src/execution/index.js';

function register(registry: CapabilityRegistry, namespace: string, operations: readonly string[]): void {
  registry.register({
    id: `vestara.api.${namespace}`,
    namespace,
    version: '1.0.0',
    permissions: operations.map((operation) => `${namespace}.${operation.split('.').at(-1) ?? 'use'}`),
    operations,
  });
}

function buildRegistry(): CapabilityRegistry {
  const registry = new CapabilityRegistry();
  register(registry, 'workflows', ['workflow.create', 'workflow.validate', 'workflow.run.start']);
  register(registry, 'tasks', ['task.create', 'task.assign']);
  register(registry, 'components', ['component.register', 'component.tree.validate']);
  register(registry, 'themes', ['theme.resolve', 'theme.mui']);
  register(registry, 'templates', ['template.instantiate']);
  register(registry, 'generator', ['generator.plan', 'generator.preview', 'generator.apply']);
  register(registry, 'verification', ['verification.run']);
  register(registry, 'tests', ['tests.run']);
  return registry;
}

describe('ExecutionServiceImpl', () => {
  it('persists a stable execution draft for the same goal', () => {
    const service = new ExecutionServiceImpl({ capabilities: buildRegistry() });
    const first = service.preview({ goal: 'Build the Theme Builder', agentId: 'vestara-developer' });
    const second = service.preview({ goal: 'Build the Theme Builder', agentId: 'vestara-developer' });

    expect(first.executionId).toBe(second.executionId);
    expect(service.list()).toHaveLength(1);
    expect(service.get(first.executionId)?.plan.summary).toContain('Theme Builder');
    expect(service.get(first.executionId)?.events.some((event) => event.type === 'plan-composed')).toBe(true);
  });
});
