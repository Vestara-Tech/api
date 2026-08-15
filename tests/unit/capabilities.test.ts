import { strict as assert } from 'node:assert';
import test from 'node:test';
import { CapabilityRegistry } from '../../src/capabilities/registry.js';

test('capability registry registers, enables, and lists', () => {
  const registry = new CapabilityRegistry();
  registry.register({
    id: 'vestara.api.system',
    namespace: 'system',
    version: 'v2',
    permissions: [],
    operations: ['system.status'],
  });
  registry.register({
    id: 'vestara.api.operations',
    namespace: 'operations',
    version: 'v2',
    permissions: [],
    operations: ['operation.list'],
  });

  assert.equal(registry.has('system'), true);
  assert.equal(registry.get('operations')?.enabled, true);
  assert.equal(registry.list().length, 2);
  assert.equal(registry.listEnabled().length, 2);

  registry.disable('operations');
  assert.equal(registry.listEnabled().length, 1);
  registry.enable('operations');
  assert.equal(registry.listEnabled().length, 2);
  assert.equal(registry.unregister('missing'), false);
});
