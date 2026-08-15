import { strict as assert } from 'node:assert';
import test from 'node:test';
import { CommandBus } from '../../src/core/commands.js';
import { createRequestContext } from '../../src/core/context.js';
import { QueryBus } from '../../src/core/queries.js';
import { EventBus } from '../../src/core/events.js';
import { OperationStore } from '../../src/core/operations.js';

test('command bus dispatches to a registered handler', async () => {
  const bus = new CommandBus();
  const ctx = createRequestContext();
  bus.register('test.do', async (command) => ({ ok: true, commandType: command.type, result: 42 }));
  const result = await bus.dispatch({ type: 'test.do', payload: {} }, ctx);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.result, 42);
});

test('command bus throws for unregistered command', async () => {
  const bus = new CommandBus();
  const ctx = createRequestContext();
  await assert.rejects(() => bus.dispatch({ type: 'missing', payload: {} }, ctx));
});

test('query bus returns data from a handler', async () => {
  const bus = new QueryBus();
  const ctx = createRequestContext();
  bus.register('test.get', async () => ({ hello: 'world' }));
  const result = await bus.ask({ name: 'test.get', input: {} }, ctx);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.data, { hello: 'world' });
});

test('query bus throws for unregistered handler', async () => {
  const bus = new QueryBus();
  const ctx = createRequestContext();
  await assert.rejects(() => bus.ask({ name: 'nope', input: {} }, ctx));
});

test('event bus notifies subscribers and supports unsubscribe', async () => {
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
  assert.deepEqual(seen.sort(), ['a', 'b']);
  off();
  bus.publish({ type: 'system.booted', category: 'system', occurredAt: new Date().toISOString(), payload: {} });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(bus.subscriberCount('system.booted'), 1);
});

test('operation store lifecycle transitions', () => {
  const store = new OperationStore();
  const op = store.create({ type: 'module.install', resourceId: 'module-x' });
  assert.equal(op.status, 'queued');
  assert.equal(store.get(op.id)?.type, 'module.install');
  store.updateStatus(op.id, 'running');
  store.updateStatus(op.id, 'completed');
  assert.equal(store.get(op.id)?.status, 'completed');
  assert.equal(store.isTerminal(store.get(op.id)!.status), true);
  assert.equal(store.get('missing'), null);
});
