import { describe, expect, it } from 'vitest';
import {
  EnvironmentSystemInventory,
  inventorySections,
  discoverKernel,
  buildDependencyGraph,
  dependenciesOf,
  dependentsOf,
  StorageManager,
  STORAGE_MUTATION_RISK,
  SystemOperationBroker,
  DevSystemOperationExecutor,
  InMemorySystemOperationStore,
  SystemV2Service,
} from '../../src/system/index.js';

describe('SYS-026 system inventory', () => {
  it('captures a normalized snapshot with honest detection status', async () => {
    const inventory = new EnvironmentSystemInventory();
    const snapshot = await inventory.capture();
    expect(snapshot.identity.hostname).toBeTruthy();
    expect(snapshot.operatingSystem.architecture).toBeTruthy();
    expect(snapshot.cpu.logicalCores).toBeGreaterThan(0);
    expect(snapshot.memory.totalBytes).toBeGreaterThan(0);
    expect(snapshot.capturedAt).toBeTruthy();
  });

  it('reports sections with detection status', async () => {
    const inventory = new EnvironmentSystemInventory();
    const snapshot = await inventory.capture();
    const sections = inventorySections(snapshot);
    expect(sections.some((s) => s.name === 'cpu' && s.status === 'supported')).toBe(true);
    expect(sections.some((s) => s.name === 'graphics' && s.status === 'unsupported')).toBe(true);
  });
});

describe('SYS-036/037 services + processes', () => {
  it('lists services and processes through SystemV2', async () => {
    const system = new SystemV2Service();
    const services = await system.services();
    expect(services.length).toBeGreaterThan(0);
    expect(services.some((s) => s.name.includes('vestara'))).toBe(true);
    const processes = await system.processes();
    expect(processes.some((p) => p.name === 'vestara-api')).toBe(true);
  });
});

describe('SYS-038/039/040 kernel + dependencies', () => {
  it('discovers the kernel with loaded modules', () => {
    const kernel = discoverKernel();
    expect(kernel.release).toBeTruthy();
    expect(['supported', 'unsupported']).toContain(kernel.status);
  });

  it('builds and queries a dependency graph', () => {
    const graph = buildDependencyGraph(
      ['api', 'agent', 'ai', 'db'],
      [
        { from: 'api', to: 'agent', kind: 'service' },
        { from: 'api', to: 'db', kind: 'package' },
        { from: 'agent', to: 'ai', kind: 'service' },
      ],
    );
    expect(dependenciesOf(graph, 'api')).toContain('agent');
    expect(dependentsOf(graph, 'ai')).toContain('agent');
    expect(graph.nodes).toEqual(['api', 'agent', 'ai', 'db']);
  });
});

describe('SYS-029/030 storage manager', () => {
  it('classifies mutation risk by severity', () => {
    expect(STORAGE_MUTATION_RISK.format).toBe('critical');
    expect(STORAGE_MUTATION_RISK.erase).toBe('critical');
    expect(STORAGE_MUTATION_RISK.mount).toBe('medium');
    const manager = new StorageManager({ listDisks: async () => [], listMounts: async () => [], mutate: async () => ({ ok: true }) });
    expect(manager.risk('format')).toBe('critical');
  });
});

describe('SYS-052..056 privileged operation protocol', () => {
  it('journals a request -> approve -> execute lifecycle', async () => {
    const broker = new SystemOperationBroker(new InMemorySystemOperationStore(), new DevSystemOperationExecutor());
    const entry = broker.request('system.service.restart', 'vestara-api.service', 'user1');
    expect(entry.status).toBe('requested');
    expect(entry.risk).toBe('high');

    broker.approve(entry.id, 'approver');
    expect(broker.get(entry.id)!.status).toBe('approved');

    const result = await broker.execute(entry.id);
    expect(result.status).toBe('failed');
    expect(result.error).toContain('vestara-systemd');
    expect(broker.journal()).toHaveLength(1);
  });

  it('rejects operations before approval', async () => {
    const broker = new SystemOperationBroker(new InMemorySystemOperationStore(), new DevSystemOperationExecutor());
    const entry = broker.request('system.power.reboot', 'host', 'user1');
    expect(entry.risk).toBe('critical');
    await expect(broker.execute(entry.id)).rejects.toThrow(/must be approved/);
  });

  it('cancels pending operations', async () => {
    const broker = new SystemOperationBroker(new InMemorySystemOperationStore(), new DevSystemOperationExecutor());
    const entry = broker.request('system.mount.create', '/data', 'user1');
    broker.cancel(entry.id);
    expect(broker.get(entry.id)!.status).toBe('cancelled');
  });
});

describe('SYS-026..056 SystemV2 composition', () => {
  it('composes inventory + runtime + operations', async () => {
    const system = new SystemV2Service();
    const snapshot = await system.snapshot();
    expect(snapshot.capturedAt).toBeTruthy();
    expect(system.kernel().release).toBeTruthy();
    const entry = system.requestOperation('system.grub.apply', '/etc/default/grub', 'user1');
    expect(entry.kind).toBe('system.grub.apply');
    system.approveOperation(entry.id, 'approver');
    await system.executeOperation(entry.id);
    expect(system.journal().length).toBe(1);
  });
});
