import { describe, expect, it } from 'vitest';
import { CapabilityRegistry } from '../../src/capabilities/registry.js';

describe('capability registry', () => {
  it('registers, enables, and lists', () => {
    const registry = new CapabilityRegistry();
    registry.register({ id: 'vestara.api.system', namespace: 'system', version: 'v2', permissions: [], operations: ['system.status'] });
    registry.register({ id: 'vestara.api.operations', namespace: 'operations', version: 'v2', permissions: [], operations: ['operation.list'] });

    expect(registry.has('system')).toBe(true);
    expect(registry.get('operations')?.enabled).toBe(true);
    expect(registry.list()).toHaveLength(2);
    expect(registry.listEnabled()).toHaveLength(2);

    registry.disable('operations');
    expect(registry.listEnabled()).toHaveLength(1);
    registry.enable('operations');
    expect(registry.listEnabled()).toHaveLength(2);
    expect(registry.unregister('missing')).toBe(false);
  });
});
