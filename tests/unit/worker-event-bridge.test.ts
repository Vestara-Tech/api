import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events.js';
import { InMemoryJobStore, EventBridge } from '../../src/worker/index.js';

describe('WKR-007 event bridge', () => {
  it('binds the global EventBus to worker jobs and preserves correlation ids', () => {
    const events = new EventBus();
    const store = new InMemoryJobStore();
    const bridge = new EventBridge({ eventBus: events, jobStore: store });

    expect(events.subscriberCount('builder.definition.published')).toBe(0);

    const unbind = bridge.bind('builder.definition.published', 'builder.after-publish', {
      extractPayload: (event) => {
        const payload = event.payload as { readonly definitionId: string; readonly revision: number; readonly ignored?: boolean };
        return { definitionId: payload.definitionId, revision: payload.revision };
      },
      maxAttempts: 5,
      metadata: { topic: 'builder' },
    });

    expect(events.subscriberCount('builder.definition.published')).toBe(1);
    expect(bridge.bindingCount('builder.definition.published')).toBe(1);

    events.publish({
      type: 'builder.definition.published',
      category: 'domain',
      occurredAt: '2026-08-17T00:00:00.000Z',
      payload: { definitionId: 'def_1', revision: 12, ignored: true },
      correlationId: 'cor_123',
    });

    const jobs = store.list({ type: 'builder.after-publish' });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.source).toBe('event');
    expect(jobs[0]!.payload).toEqual({ definitionId: 'def_1', revision: 12 });
    expect(jobs[0]!.correlationId).toBe('cor_123');
    expect(jobs[0]!.maxAttempts).toBe(5);
    expect(jobs[0]!.eventType).toBe('builder.definition.published');

    unbind();
    expect(events.subscriberCount('builder.definition.published')).toBe(0);
    expect(bridge.bindingCount('builder.definition.published')).toBe(0);

    events.publish({
      type: 'builder.definition.published',
      category: 'domain',
      occurredAt: '2026-08-17T00:00:01.000Z',
      payload: { definitionId: 'def_2', revision: 13 },
    });

    expect(store.list({ type: 'builder.after-publish' })).toHaveLength(1);
  });
});
