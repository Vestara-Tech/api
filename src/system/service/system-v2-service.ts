import type { SystemSnapshot } from '../inventory/domain.js';
import { EnvironmentSystemInventory } from '../inventory/environment.js';
import type { ServiceInfo, ProcessInfo } from '../runtime/services.js';
import { EnvironmentServiceManager, SystemdServiceManager } from '../runtime/services.js';
import { discoverKernel, buildDependencyGraph, type KernelInfo, type DependencyGraph, type DependencyEdge } from '../runtime/kernel.js';
import type { StorageMutationKind } from '../runtime/storage.js';
import { EnvironmentStorageManager, StorageManager } from '../runtime/storage.js';
import type { SystemOperationKind } from './system-operations.js';
import { SystemOperationBroker, DevSystemOperationExecutor, InMemorySystemOperationStore } from './system-operations.js';

export interface SystemV2Options {
  readonly inventory?: EnvironmentSystemInventory;
  readonly serviceManager?: SystemdServiceManager;
  readonly storage?: StorageManager;
  readonly operations?: SystemOperationBroker;
}

/**
 * SYS-026..056 — System Module V2 composition root. Inventory (SystemSnapshot),
 * runtime (services/processes/kernel), storage, and the privileged operation
 * broker compose above the base SystemService. The API is the control plane;
 * a privileged vestara-systemd daemon is the execution plane.
 */
export class SystemV2Service {
  private readonly inventory: EnvironmentSystemInventory;
  private readonly serviceManager: SystemdServiceManager;
  private readonly storage: StorageManager;
  private readonly operations: SystemOperationBroker;

  constructor(options: SystemV2Options = {}) {
    this.inventory = options.inventory ?? new EnvironmentSystemInventory();
    this.serviceManager = options.serviceManager ?? new SystemdServiceManager(new EnvironmentServiceManager());
    this.storage = options.storage ?? new StorageManager(new EnvironmentStorageManager());
    this.operations = options.operations ?? new SystemOperationBroker(new InMemorySystemOperationStore(), new DevSystemOperationExecutor());
  }

  async snapshot(): Promise<SystemSnapshot> {
    return this.inventory.capture();
  }

  async services(): Promise<readonly ServiceInfo[]> {
    return this.serviceManager.list();
  }

  async processes(): Promise<readonly ProcessInfo[]> {
    return this.serviceManager.processes();
  }

  kernel(): KernelInfo {
    return discoverKernel();
  }

  dependencyGraph(nodes: readonly string[], edges: readonly DependencyEdge[]): DependencyGraph {
    return buildDependencyGraph(nodes, edges);
  }

  async storageDisks() {
    return this.storage.disks();
  }

  async storageMounts() {
    return this.storage.mounts();
  }

  storageRisk(kind: StorageMutationKind): string {
    return this.storage.risk(kind);
  }

  requestOperation(kind: SystemOperationKind, target: string, requestedBy: string, payload?: Readonly<Record<string, unknown>>) {
    return this.operations.request(kind, target, requestedBy, payload);
  }

  approveOperation(id: string, approvedBy: string) {
    return this.operations.approve(id, approvedBy);
  }

  executeOperation(id: string) {
    return this.operations.execute(id);
  }

  journal() {
    return this.operations.journal();
  }

  operation(id: string) {
    return this.operations.get(id);
  }
}
