export type VestaraEventCategory = 'system' | 'operation' | 'domain';

export interface VestaraEvent {
  readonly type: string;
  readonly category: VestaraEventCategory;
  readonly occurredAt: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly correlationId?: string;
  readonly requestId?: string;
}

export type EventListener = (event: VestaraEvent) => void | Promise<void>;

export class EventBus {
  private readonly listeners = new Map<string, Set<EventListener>>();

  subscribe(eventType: string, listener: EventListener): () => void {
    const set = this.listeners.get(eventType) ?? new Set<EventListener>();
    set.add(listener);
    this.listeners.set(eventType, set);
    return () => {
      set.delete(listener);
    };
  }

  publish(event: VestaraEvent): void {
    const listeners = this.listeners.get(event.type);
    if (!listeners) return;
    for (const listener of listeners) {
      void Promise.resolve(listener(event)).catch((err) => {
        console.error(`[event-bus] listener for "${event.type}" failed`, err);
      });
    }
  }

  subscriberCount(eventType: string): number {
    return this.listeners.get(eventType)?.size ?? 0;
  }
}
