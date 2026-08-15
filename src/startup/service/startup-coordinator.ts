import { EventBus } from '../../core/events.js';
import type { StartupState, StartupStatus } from '../domain/state.js';
import { createStartupState, resolveDestination, transitionStartup, type StartupStateInput } from '../domain/state.js';
import type { StartupServiceDefinition, ServiceReadinessState, ServiceReadiness } from '../domain/readiness.js';
import { ServiceReadinessRegistry } from '../domain/readiness.js';
import { StartupDependencyGraph } from '../domain/dependency-graph.js';
import { computeProgress, type ProgressSnapshot } from '../domain/progress.js';
import { classifyStartup, type StartupClassificationResult } from '../domain/classification.js';
import { makeStartupEvent } from '../domain/events.js';

export interface StartupCoordinatorOptions {
  readonly events: EventBus;
  readonly services: readonly StartupServiceDefinition[];
  readonly stateInput?: StartupStateInput;
}

export interface StartupSnapshot {
  readonly state: StartupState;
  readonly progress: ProgressSnapshot;
  readonly services: readonly ServiceReadinessState[];
  readonly classification: StartupClassificationResult;
}

/**
 * DESK-002 — Startup coordinator.
 *
 * The startup screen is a projection of this backend state machine, never a
 * client-side guess. Startup determines whether the machine can run; Login
 * determines who may establish the session.
 */
export class StartupCoordinator {
  private state: StartupState;
  private readonly registry: ServiceReadinessRegistry;
  private readonly graph: StartupDependencyGraph;
  private readonly events: EventBus;

  constructor(options: StartupCoordinatorOptions) {
    this.events = options.events;
    this.registry = new ServiceReadinessRegistry(options.services);
    this.graph = new StartupDependencyGraph(options.services);
    this.state = createStartupState(options.stateInput);
    this.state.status = 'booting';
    this.state.destination = resolveDestination(this.state);
    this.emit('startup.transition', { to: 'booting' });
  }

  getSnapshot(): StartupSnapshot {
    return {
      state: this.state,
      progress: computeProgress(this.registry.all()),
      services: this.registry.all(),
      classification: classifyStartup(this.registry.definitions(), this.registry.all(), this.graph),
    };
  }

  private emit(type: import('../domain/events.js').StartupEventType, payload: import('../domain/events.js').StartupEventPayload): void {
    this.events.publish(makeStartupEvent(type, payload));
  }

  stateValue(): StartupState {
    return this.state;
  }

  transition(to: StartupStatus): void {
    this.state.status = transitionStartup(this.state.status, to);
    this.state.destination = resolveDestination(this.state);
    this.emit('startup.transition', { to });
  }

  updateService(serviceId: string, readiness: ServiceReadiness, detail?: string): void {
    const updated = this.registry.update(serviceId, readiness, detail);
    this.emit('startup.service', { serviceId, readiness, detail });
    void updated;
    this.recompute();
  }

  markFailure(stage: StartupStatus, message: string): void {
    this.state.status = 'failed';
    this.state.failure = { stage, message, at: new Date().toISOString() };
    this.state.destination = resolveDestination(this.state);
    this.emit('startup.failed', { stage, message });
  }

  complete(): void {
    this.state.status = 'ready';
    this.state.readyAt = new Date().toISOString();
    this.state.destination = resolveDestination(this.state);
    this.emit('startup.ready', {});
  }

  /** Recompute overall status based on service readiness classification. */
  private recompute(): void {
    if (this.state.status === 'failed' || this.state.status === 'ready') return;
    const result = classifyStartup(this.registry.definitions(), this.registry.all(), this.graph);
    if (result.classification === 'failed') {
      this.markFailure('starting-services', 'required service failed');
    } else if (result.classification === 'degraded' && this.state.status === 'starting-services') {
      this.state.status = 'degraded';
      this.state.destination = resolveDestination(this.state);
      this.emit('startup.degraded', { issues: result.issues.map((i) => i.message) });
    }
  }
}
