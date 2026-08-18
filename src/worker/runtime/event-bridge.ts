import { newCorrelationId } from '../../core/identifiers.js';
import type { EventBus, VestaraEvent } from '../../core/events.js';
import type { JobMetadata } from '../contracts.js';
import type { JobStore } from '../store/job-store.js';

export interface EventBridgeBindingOptions<TPayload = unknown> {
  readonly extractPayload?: (event: VestaraEvent) => TPayload;
  readonly maxAttempts?: number;
  readonly metadata?: JobMetadata;
}

export interface EventBridgeOptions {
  readonly eventBus: EventBus;
  readonly jobStore: JobStore;
}

export interface EventBridgeBinding {
  readonly eventType: string;
  readonly jobType: string;
  readonly unsubscribe: () => void;
}

/**
 * WKR-007 — Event bridge from the global EventBus to worker jobs.
 */
export class EventBridge {
  private readonly eventBus: EventBus;
  private readonly jobStore: JobStore;
  private readonly bindings = new Map<string, Set<EventBridgeBinding>>();

  constructor(options: EventBridgeOptions) {
    this.eventBus = options.eventBus;
    this.jobStore = options.jobStore;
  }

  bind<TPayload = unknown>(
    eventType: string,
    jobType: string,
    options: EventBridgeBindingOptions<TPayload> = {},
  ): () => void {
    const listener = (event: VestaraEvent): void => {
      const correlationId = event.correlationId ?? event.requestId ?? newCorrelationId();
      const payload = options.extractPayload ? options.extractPayload(event) : (event.payload as TPayload);
      this.jobStore.enqueue({
        type: jobType,
        payload,
        source: 'event',
        ...(options.maxAttempts !== undefined ? { maxAttempts: options.maxAttempts } : {}),
        ...(options.metadata !== undefined ? { metadata: options.metadata } : {}),
        eventType,
        correlationId,
      });
    };

    const unsubscribe = this.eventBus.subscribe(eventType, listener);
    const binding: EventBridgeBinding = { eventType, jobType, unsubscribe };
    const list = this.bindings.get(eventType) ?? new Set<EventBridgeBinding>();
    list.add(binding);
    this.bindings.set(eventType, list);

    return () => {
      unsubscribe();
      const current = this.bindings.get(eventType);
      if (!current) return;
      current.delete(binding);
      if (current.size === 0) this.bindings.delete(eventType);
    };
  }

  listBindings(eventType?: string): readonly EventBridgeBinding[] {
    if (eventType !== undefined) return [...(this.bindings.get(eventType) ?? new Set<EventBridgeBinding>())];
    return [...this.bindings.values()].flatMap((set) => [...set]);
  }

  bindingCount(eventType?: string): number {
    if (eventType !== undefined) return this.bindings.get(eventType)?.size ?? 0;
    return this.listBindings().length;
  }
}
