import { describe, expect, it } from 'vitest';
import { canTransitionStartup, resolveDestination, createStartupState, type StartupState } from '../../src/startup/domain/state.js';
import { computeProgress } from '../../src/startup/domain/progress.js';
import { classifyStartup } from '../../src/startup/domain/classification.js';
import { StartupDependencyGraph } from '../../src/startup/domain/dependency-graph.js';
import { ServiceReadinessRegistry } from '../../src/startup/domain/readiness.js';
import type { StartupServiceDefinition } from '../../src/startup/domain/readiness.js';

const SERVICES: readonly StartupServiceDefinition[] = [
  { id: 'system', name: 'System', category: 'system', weight: 10, required: true },
  { id: 'api', name: 'API', category: 'api', weight: 20, required: true, dependsOn: ['system'] },
  { id: 'workspace', name: 'Workspace', category: 'workspace', weight: 20, required: true, dependsOn: ['api'] },
  { id: 'agents', name: 'Agents', category: 'agents', weight: 10, required: false, dependsOn: ['api'] },
];

describe('startup state machine + routing (DESK-001)', () => {
  it('follows the happy path booting→initializing→starting-services→verifying→ready', () => {
    expect(canTransitionStartup('booting', 'initializing')).toBe(true);
    expect(canTransitionStartup('initializing', 'starting-services')).toBe(true);
    expect(canTransitionStartup('starting-services', 'verifying')).toBe(true);
    expect(canTransitionStartup('verifying', 'ready')).toBe(true);
  });

  it('routes to onboarding on first boot', () => {
    const state: StartupState = { status: 'ready', destination: 'none', firstBoot: true, authenticated: true, sessionReady: true };
    expect(resolveDestination(state)).toBe('onboarding');
  });

  it('routes to login when unauthenticated', () => {
    const state: StartupState = { status: 'ready', destination: 'none', firstBoot: false, authenticated: false, sessionReady: false };
    expect(resolveDestination(state)).toBe('login');
  });

  it('routes to desktop when ready and session established', () => {
    const state: StartupState = { status: 'ready', destination: 'none', firstBoot: false, authenticated: true, sessionReady: true };
    expect(resolveDestination(state)).toBe('desktop');
  });

  it('routes failed boot to recovery and later failures to diagnostics', () => {
    const bootFail: StartupState = { status: 'failed', destination: 'none', firstBoot: false, authenticated: false, sessionReady: false, failure: { stage: 'booting', message: 'x', at: '' } };
    expect(resolveDestination(bootFail)).toBe('recovery');
    const serviceFail: StartupState = { status: 'failed', destination: 'none', firstBoot: false, authenticated: false, sessionReady: false, failure: { stage: 'starting-services', message: 'x', at: '' } };
    expect(resolveDestination(serviceFail)).toBe('diagnostics');
  });

  it('creates an uninitialized state', () => {
    const state = createStartupState();
    expect(state.status).toBe('uninitialized');
    expect(state.destination).toBe('onboarding');
  });
});

describe('progress aggregation (DESK-005)', () => {
  it('computes weighted progress', () => {
    const states = [
      { serviceId: 'system', readiness: 'ready', weight: 10, updatedAt: '' },
      { serviceId: 'api', readiness: 'starting', weight: 20, updatedAt: '' },
      { serviceId: 'workspace', readiness: 'not-started', weight: 20, updatedAt: '' },
    ];
    const progress = computeProgress(states);
    expect(progress.totalCount).toBe(3);
    expect(progress.readyCount).toBe(1);
    // (10*100 + 20*45 + 20*0) / 50 = (1000+900)/50 = 38
    expect(progress.overallPercent).toBe(38);
  });

  it('returns zero for no services', () => {
    expect(computeProgress([]).overallPercent).toBe(0);
  });
});

describe('dependency graph + classification (DESK-004/006)', () => {
  it('produces deterministic topological order', () => {
    const graph = new StartupDependencyGraph(SERVICES);
    const order = graph.order();
    expect(order.indexOf('system')).toBeLessThan(order.indexOf('api'));
    expect(order.indexOf('api')).toBeLessThan(order.indexOf('workspace'));
    expect(order).toHaveLength(4);
  });

  it('reports blocked services with unresolved required deps', () => {
    const graph = new StartupDependencyGraph(SERVICES);
    const blocked = graph.blocked((id) => id !== 'system');
    // api depends only on system (resolved) → not blocked; workspace and agents
    // depend on api (unresolved) → blocked.
    expect(blocked).not.toContain('api');
    expect(blocked).toContain('workspace');
    expect(blocked).toContain('agents');
  });

  it('classifies a required service failure as failed', () => {
    const registry = new ServiceReadinessRegistry(SERVICES);
    registry.update('system', 'ready');
    registry.update('api', 'failed');
    registry.update('workspace', 'not-started');
    registry.update('agents', 'not-started');
    const graph = new StartupDependencyGraph(SERVICES);
    const result = classifyStartup(SERVICES, registry.all(), graph);
    expect(result.classification).toBe('failed');
    expect(result.issues.some((i) => i.kind === 'failed-required')).toBe(true);
  });

  it('classifies only optional failure as degraded', () => {
    const registry = new ServiceReadinessRegistry(SERVICES);
    registry.update('system', 'ready');
    registry.update('api', 'ready');
    registry.update('workspace', 'ready');
    registry.update('agents', 'failed');
    const graph = new StartupDependencyGraph(SERVICES);
    const result = classifyStartup(SERVICES, registry.all(), graph);
    expect(result.classification).toBe('degraded');
    expect(result.issues.some((i) => i.kind === 'failed-optional')).toBe(true);
  });

  it('classifies all ready as healthy', () => {
    const registry = new ServiceReadinessRegistry(SERVICES);
    for (const def of SERVICES) registry.update(def.id, 'ready');
    const graph = new StartupDependencyGraph(SERVICES);
    const result = classifyStartup(SERVICES, registry.all(), graph);
    expect(result.classification).toBe('healthy');
  });
});
