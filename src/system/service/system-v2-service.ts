import type { SystemSnapshot } from '../inventory/domain.js';
import { EnvironmentSystemInventory } from '../inventory/environment.js';
import type { ServiceInfo, ProcessInfo } from '../runtime/services.js';
import { EnvironmentServiceManager, SystemdServiceManager } from '../runtime/services.js';
import { discoverKernel, buildDependencyGraph, type KernelInfo, type DependencyGraph, type DependencyEdge } from '../runtime/kernel.js';
import type { StorageMutationKind } from '../runtime/storage.js';
import { EnvironmentStorageManager, StorageManager } from '../runtime/storage.js';
import type { SystemOperationKind } from './system-operations.js';
import { SystemOperationBroker, DevSystemOperationExecutor, InMemorySystemOperationStore } from './system-operations.js';
import { ApprovalWorkflow, RollbackFramework } from './approval-rollback.js';
import { VestaraSystemDaemon, devSystemDaemon, SystemReconciler, type ReconciliationResult } from './daemon.js';
import { SystemIntegrations, type SystemHealthStatus, type SystemIntegrationOptions } from './integrations.js';

export interface SystemV2Options {
  readonly inventory?: EnvironmentSystemInventory;
  readonly serviceManager?: SystemdServiceManager;
  readonly storage?: StorageManager;
  readonly operations?: SystemOperationBroker;
  readonly daemon?: VestaraSystemDaemon;
  readonly approvals?: ApprovalWorkflow;
  readonly rollback?: RollbackFramework;
  readonly integrations?: SystemIntegrations;
}

/**
 * SYS-026..064 — System Module V2 composition root. Inventory (SystemSnapshot),
 * runtime (services/processes/kernel), storage, the privileged operation
 * broker with approvals + rollback, the vestara-systemd daemon execution
 * plane, config reconciliation and module integrations.
 */
export class SystemV2Service {
  private readonly inventory: EnvironmentSystemInventory;
  private readonly serviceManager: SystemdServiceManager;
  private readonly storage: StorageManager;
  private readonly operations: SystemOperationBroker;
  private readonly daemon: VestaraSystemDaemon;
  private readonly approvals: ApprovalWorkflow;
  private readonly rollback: RollbackFramework;
  private readonly integrations: SystemIntegrations;
  private readonly reconciler: SystemReconciler;

  constructor(options: SystemV2Options = {}) {
    this.inventory = options.inventory ?? new EnvironmentSystemInventory();
    this.serviceManager = options.serviceManager ?? new SystemdServiceManager(new EnvironmentServiceManager());
    this.storage = options.storage ?? new StorageManager(new EnvironmentStorageManager());
    this.operations = options.operations ?? new SystemOperationBroker(new InMemorySystemOperationStore(), new DevSystemOperationExecutor());
    this.daemon = options.daemon ?? devSystemDaemon();
    this.approvals = options.approvals ?? new ApprovalWorkflow();
    this.rollback = options.rollback ?? new RollbackFramework();
    this.integrations = options.integrations ?? new SystemIntegrations();
    this.reconciler = new SystemReconciler(() => undefined);
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

  /** SYS-052 — typed daemon execution with approval + rollback integration. */
  async daemonExecute(kind: SystemOperationKind, target: string, requestedBy: string, payload?: Readonly<Record<string, unknown>>) {
    const journal = this.operations.request(kind, target, requestedBy, payload);
    const approval = this.approvals.create({ id: journal.id, kind, risk: journal.risk });
    const preImage = payload;
    const rollbackPoint = this.rollback.capture({ operationId: journal.id, target, kind, preImage });
    return { journal, approval, rollbackPoint };
  }

  async daemonApproveAndRun(approvalId: string, approver: string) {
    const approval = this.approvals.approve(approvalId, approver);
    if (!this.approvals.isApproved(approvalId)) return { approval, executed: false, result: null };
    const op = this.operations.get(approval.operationId);
    if (!op) throw new Error('Operation not found');
    this.operations.approve(approval.operationId, approver);
    const result = await this.daemon.execute(op.kind, op.target);
    if (!result.ok) {
      this.rollback.rollbackAll(op.id);
      this.operations.reject(op.id);
    } else {
      this.rollback.commit(approval.operationId);
    }
    return { approval, executed: true, result };
  }

  approvalsList() {
    return this.approvals.list();
  }

  approvalsGet(id: string) {
    return this.approvals.get(id);
  }

  rollbackPoints(operationId: string) {
    return this.rollback.pointsFor(operationId);
  }

  daemonRefuses(kind: string): boolean {
    return this.daemon.refuses(kind);
  }

  reconcile(desired: Readonly<Record<string, unknown>>): ReconciliationResult {
    return this.reconciler.reconcile(desired);
  }

  async health(): Promise<SystemHealthStatus> {
    return this.integrations.health(await this.snapshot());
  }

  integrationsConfigured() {
    return this.integrations.configured();
  }
}
