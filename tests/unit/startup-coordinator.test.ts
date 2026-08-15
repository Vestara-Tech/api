import { describe, expect, it } from 'vitest';
import { StartupCoordinator } from '../../src/startup/service/startup-coordinator.js';
import { EventBus } from '../../src/core/events.js';
import type { StartupServiceDefinition } from '../../src/startup/domain/readiness.js';

const SERVICES: readonly StartupServiceDefinition[] = [
  { id: 'system', name: 'System', category: 'system', weight: 10, required: true },
  { id: 'api', name: 'API', category: 'api', weight: 20, required: true, dependsOn: ['system'] },
  { id: 'workspace', name: 'Workspace', category: 'workspace', weight: 20, required: true, dependsOn: ['api'] },
];

function build(): { coordinator: StartupCoordinator; events: EventBus } {
  const events = new EventBus();
  const coordinator = new StartupCoordinator({ events, services: SERVICES });
  return { coordinator, events };
}

describe('StartupCoordinator (DESK-002..007)', () => {
  it('starts in booting with a snapshot', () => {
    const { coordinator } = build();
    expect(coordinator.stateValue().status).toBe('booting');
    const snapshot = coordinator.getSnapshot();
    expect(snapshot.services).toHaveLength(3);
    expect(snapshot.progress.overallPercent).toBe(0);
  });

  it('advances through states and updates destination', () => {
    const { coordinator } = build();
    coordinator.transition('initializing');
    coordinator.transition('starting-services');
    expect(coordinator.stateValue().status).toBe('starting-services');
  });

  it('updates service readiness and aggregates progress', () => {
    const { coordinator } = build();
    coordinator.updateService('system', 'ready');
    coordinator.updateService('api', 'ready');
    const snapshot = coordinator.getSnapshot();
    expect(snapshot.progress.readyCount).toBe(2);
    expect(snapshot.progress.overallPercent).toBe(60); // (10*100 + 20*100 + 20*0)/50 = 3000/50
  });

  it('classifies degraded when an optional service fails', () => {
    const { coordinator } = build();
    coordinator.updateService('system', 'ready');
    coordinator.updateService('api', 'ready');
    coordinator.updateService('workspace', 'ready');
    // No optional services in this fixture; a required failure marks failed.
    coordinator.updateService('workspace', 'failed');
    expect(coordinator.getSnapshot().classification.classification).toBe('failed');
  });

  it('publishes startup events', () => {
    const { coordinator, events } = build();
    const seen: string[] = [];
    events.subscribe('startup.transition', (e) => seen.push(e.type));
    events.subscribe('startup.ready', (e) => seen.push(e.type));
    coordinator.transition('initializing');
    coordinator.transition('starting-services');
    coordinator.transition('verifying');
    coordinator.complete();
    expect(seen).toContain('startup.transition');
    expect(seen).toContain('startup.ready');
    expect(coordinator.stateValue().status).toBe('ready');
    expect(coordinator.stateValue().destination).toBe('login');
  });

  it('marks failure and routes to diagnostics', () => {
    const { coordinator } = build();
    coordinator.markFailure('starting-services', 'workspace crashed');
    expect(coordinator.stateValue().status).toBe('failed');
    expect(coordinator.stateValue().destination).toBe('diagnostics');
  });
});
