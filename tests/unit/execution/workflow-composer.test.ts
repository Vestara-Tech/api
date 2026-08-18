import { describe, expect, it } from 'vitest';
import { CapabilityRegistry } from '../../../src/capabilities/registry.js';
import { IntentResolver, WorkflowComposer } from '../../../src/execution/index.js';
import type { ResolvedCapability } from '../../../src/execution/domain/contracts.js';

function register(registry: CapabilityRegistry, namespace: string, operations: readonly string[]): void {
  registry.register({
    id: `vestara.api.${namespace}`,
    namespace,
    version: '1.0.0',
    permissions: operations.map((operation) => `${namespace}.${operation.split('.').at(-1) ?? 'use'}`),
    operations,
  });
}

function buildCapabilities(): readonly ResolvedCapability[] {
  const registry = new CapabilityRegistry();
  register(registry, 'workflows', ['workflow.create', 'workflow.validate', 'workflow.run.start']);
  register(registry, 'tasks', ['task.create', 'task.assign']);
  register(registry, 'components', ['component.register', 'component.tree.validate']);
  register(registry, 'themes', ['theme.resolve', 'theme.mui']);
  register(registry, 'templates', ['template.instantiate']);
  register(registry, 'generator', ['generator.plan', 'generator.preview', 'generator.apply']);
  register(registry, 'verification', ['verification.run']);
  register(registry, 'tests', ['tests.run']);
  register(registry, 'browser', ['browser.screenshot']);
  register(registry, 'files', ['file.transaction.preview', 'file.transaction.apply']);
  return registry.list().map((capability) => ({
    namespace: capability.namespace,
    version: capability.version,
    permissions: capability.permissions,
    operations: capability.operations,
  }));
}

describe('WorkflowComposer', () => {
  it('builds a governed plan for the Theme Builder', () => {
    const request = {
      id: 'exec_theme',
      goal: 'Build the Theme Builder',
      agentId: 'vestara-developer',
      roomId: 'activity-room',
      requestedAt: '2026-08-18T00:00:00.000Z',
    };
    const intent = new IntentResolver().resolve(request.goal);
    const composer = new WorkflowComposer();
    const plan = composer.compose({
      request,
      intent,
      capabilities: buildCapabilities(),
      missingCapabilities: [],
    });

    expect(plan.status).toBe('planning');
    expect(plan.milestones).toHaveLength(3);
    expect(plan.milestones[0]?.steps.map((step) => step.operation)).toContain('workflow.create');
    expect(plan.milestones[1]?.steps.some((step) => step.requiresApproval)).toBe(true);
    expect(plan.evidence).toContain('verification report');
    expect(plan.summary).toContain('Theme Builder');
  });
});
