import { describe, expect, it } from 'vitest';
import { CommandBus } from '../../src/core/commands.js';
import { createRequestContext } from '../../src/core/context.js';
import { QueryBus } from '../../src/core/queries.js';
import { EventBus } from '../../src/core/events.js';
import { OperationStore } from '../../src/core/operations.js';

const ctx = createRequestContext();

describe('command bus', () => {
  it('dispatches to a registered handler', async () => {
    const bus = new CommandBus();
    bus.register('test.do', async (command) => ({ ok: true, commandType: command.type, result: 42 }));
    const result = await bus.dispatch({ type: 'test.do', payload: {} }, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.result).toBe(42);
  });

  it('throws for unregistered command', async () => {
    const bus = new CommandBus();
    await expect(bus.dispatch({ type: 'missing', payload: {} }, ctx)).rejects.toThrow();
  });
});

describe('query bus', () => {
  it('returns data from a handler', async () => {
    const bus = new QueryBus();
    bus.register('test.get', async () => ({ hello: 'world' }));
    const result = await bus.ask({ name: 'test.get', input: {} }, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ hello: 'world' });
  });

  it('throws for unregistered handler', async () => {
    const bus = new QueryBus();
    await expect(bus.ask({ name: 'nope', input: {} }, ctx)).rejects.toThrow();
  });
});

describe('event bus', () => {
  it('notifies subscribers and supports unsubscribe', async () => {
    const bus = new EventBus();
    const seen: string[] = [];
    const off = bus.subscribe('system.booted', () => {
      seen.push('a');
    });
    bus.subscribe('system.booted', () => {
      seen.push('b');
    });
    bus.publish({ type: 'system.booted', category: 'system', occurredAt: new Date().toISOString(), payload: {} });
    await new Promise((r) => setTimeout(r, 10));
    expect([...seen].sort()).toEqual(['a', 'b']);
    off();
    expect(bus.subscriberCount('system.booted')).toBe(1);
  });
});

describe('operation store', () => {
  it('transitions through lifecycle', () => {
    const store = new OperationStore();
    const op = store.create({ type: 'module.install', resourceId: 'module-x' });
    expect(op.status).toBe('queued');
    store.updateStatus(op.id, 'running');
    store.updateStatus(op.id, 'completed');
    expect(store.get(op.id)?.status).toBe('completed');
    expect(store.isTerminal(store.get(op.id)!.status)).toBe(true);
    expect(store.get('missing')).toBeNull();
  });
});
