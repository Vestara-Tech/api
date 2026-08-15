import { badRequest, conflict } from '../../core/errors.js';
import { randomId } from '../../core/identifiers.js';
import { createHash } from 'node:crypto';
import type {
  FileEvent,
  FileOperation,
  FileResource,
  FileSearchQuery,
  FileTransaction,
  FileVersionRecord,
  FileWorkspace,
} from '../domain/contracts.js';
import { WorkspaceSandbox } from '../domain/workspace-sandbox.js';
import type { FileProviderPort } from '../providers/file-provider-port.js';

export interface FileServiceOptions {
  readonly providers: Readonly<Record<string, FileProviderPort>>;
}

export interface FileService {
  mountWorkspace(workspace: FileWorkspace): FileWorkspace;
  unmountWorkspace(workspaceId: string): void;
  listWorkspaces(): readonly FileWorkspace[];

  read(workspaceId: string, path: string): Promise<{ content: string; resource: FileResource }>;
  list(workspaceId: string, directoryPath: string): Promise<readonly FileResource[]>;
  stat(workspaceId: string, path: string): Promise<FileResource>;
  search(workspaceId: string, query: FileSearchQuery): Promise<readonly FileResource[]>;

  createTransaction(workspaceId: string, operations: readonly FileOperation[], principalId?: string): FileTransaction;
  validateTransaction(transactionId: string): FileTransaction;
  previewTransaction(transactionId: string): FileTransaction;
  applyTransaction(transactionId: string, options?: { approved?: boolean; principalId?: string }): Promise<FileTransaction>;
  rollbackTransaction(transactionId: string): Promise<FileTransaction>;

  versions(workspaceId: string, path: string): readonly FileVersionRecord[];
  events(): readonly FileEvent[];
}

/**
 * FILE — Governed file service. Modules request file capabilities here; they
 * never receive raw `fs`. Every mutation goes through a validated transaction
 * with preview, policy, apply and evidence.
 */
export class FileService implements FileService {
  private readonly providers: Readonly<Record<string, FileProviderPort>>;
  private readonly workspaces = new Map<string, FileWorkspace>();
  private readonly transactions = new Map<string, FileTransaction>();
  private readonly versionRecords = new Map<string, FileVersionRecord[]>();
  private readonly emitted: FileEvent[] = [];
  private readonly snapshots = new Map<string, Readonly<Record<string, string>>>();

  constructor(options: FileServiceOptions) {
    this.providers = options.providers;
  }

  mountWorkspace(workspace: FileWorkspace): FileWorkspace {
    if (this.workspaces.has(workspace.id)) throw conflict(`Workspace "${workspace.id}" already mounted`);
    if (!this.providers[workspace.providerId]) throw badRequest(`Unknown file provider "${workspace.providerId}"`);
    this.workspaces.set(workspace.id, workspace);
    this.emit({ type: 'workspace.mounted', at: new Date().toISOString(), workspaceId: workspace.id });
    return workspace;
  }

  unmountWorkspace(workspaceId: string): void {
    this.workspaces.delete(workspaceId);
    this.emit({ type: 'workspace.unmounted', at: new Date().toISOString(), workspaceId });
  }

  listWorkspaces(): readonly FileWorkspace[] {
    return [...this.workspaces.values()];
  }

  async read(workspaceId: string, path: string): Promise<{ content: string; resource: FileResource }> {
    const sandbox = this.sandbox(workspaceId);
    const resolved = sandbox.assertAllowed(path);
    const provider = this.provider(workspaceId);
    return provider.read(resolved);
  }

  async list(workspaceId: string, directoryPath: string): Promise<readonly FileResource[]> {
    const sandbox = this.sandbox(workspaceId);
    const resolved = sandbox.resolve(directoryPath);
    const provider = this.provider(workspaceId);
    return provider.list(resolved);
  }

  async stat(workspaceId: string, path: string): Promise<FileResource> {
    const sandbox = this.sandbox(workspaceId);
    const resolved = sandbox.assertAllowed(path);
    return this.provider(workspaceId).stat(resolved);
  }

  async search(workspaceId: string, query: FileSearchQuery): Promise<readonly FileResource[]> {
    const sandbox = this.sandbox(workspaceId);
    const workspace = this.workspace(workspaceId);
    return this.provider(workspaceId).search(query.pattern, workspace.root, query.limit ?? 50);
  }

  createTransaction(workspaceId: string, operations: readonly FileOperation[], principalId?: string): FileTransaction {
    const sandbox = this.sandbox(workspaceId);
    for (const op of operations) sandbox.assertAllowedOperation(op);
    const transaction: FileTransaction = {
      id: randomId('ftx'),
      workspaceId,
      operations,
      status: 'draft',
      createdAt: new Date().toISOString(),
      ...(principalId !== undefined ? { principalId } : {}),
    };
    this.transactions.set(transaction.id, transaction);
    this.emit({ type: 'file.transaction.created', at: new Date().toISOString(), workspaceId, data: { transactionId: transaction.id } });
    return transaction;
  }

  validateTransaction(transactionId: string): FileTransaction {
    const transaction = this.transaction(transactionId);
    const sandbox = this.sandbox(transaction.workspaceId);
    for (const op of transaction.operations) sandbox.assertAllowedOperation(op);
    const validated: FileTransaction = { ...transaction, status: 'validated' };
    this.transactions.set(transactionId, validated);
    this.emit({ type: 'file.transaction.validated', at: new Date().toISOString(), workspaceId: transaction.workspaceId, data: { transactionId } });
    return validated;
  }

  previewTransaction(transactionId: string): FileTransaction {
    const transaction = this.transaction(transactionId);
    const preview = transaction.operations.map((op) => ({
      path: op.path,
      operation: op.kind,
      addedLines: op.content !== undefined ? op.content.split('\n').length : 0,
      removedLines: op.kind === 'delete' ? 1 : 0,
    }));
    const updated: FileTransaction = { ...transaction, status: 'validated', preview };
    this.transactions.set(transactionId, updated);
    return updated;
  }

  async applyTransaction(transactionId: string, options: { approved?: boolean; principalId?: string } = {}): Promise<FileTransaction> {
    const transaction = this.transaction(transactionId);
    if (transaction.status === 'applied') return transaction;
    const workspace = this.workspace(transaction.workspaceId);
    const provider = this.provider(transaction.workspaceId);
    const sandbox = this.sandbox(transaction.workspaceId);

    this.transactions.set(transactionId, { ...transaction, status: 'applying' });
    try {
      // Snapshot affected paths for rollback (if provider supports it).
      const affected = transaction.operations.map((op) => sandbox.resolve(op.path));
      if (provider.snapshot) {
        this.snapshots.set(transactionId, await provider.snapshot(affected));
      }
      for (const op of transaction.operations) {
        const resolved = sandbox.resolve(op.path);
        switch (op.kind) {
          case 'create':
            await provider.create({ path: resolved, content: op.content ?? '' });
            break;
          case 'update':
          case 'append':
            await provider.write({ path: resolved, content: op.content ?? '' });
            break;
          case 'delete':
            await provider.remove(resolved);
            break;
          case 'mkdir':
            await provider.mkdir(resolved);
            break;
          case 'copy':
          case 'move': {
            if (!op.destination) throw badRequest(`${op.kind} requires destination`);
            const dest = sandbox.resolve(op.destination);
            if (op.kind === 'copy') await provider.copy(resolved, dest);
            else await provider.move(resolved, dest);
            break;
          }
          case 'rename': {
            if (!op.destination) throw badRequest('rename requires destination');
            await provider.move(resolved, sandbox.resolve(op.destination));
            break;
          }
        }
        this.recordVersion(transaction, op, options.principalId ?? 'system');
      }
      const applied: FileTransaction = {
        ...transaction,
        status: 'applied',
        appliedAt: new Date().toISOString(),
        ...(options.principalId !== undefined ? { principalId: options.principalId } : {}),
      };
      this.transactions.set(transactionId, applied);
      this.emit({ type: 'file.transaction.applied', at: new Date().toISOString(), workspaceId: workspace.id, data: { transactionId, operations: transaction.operations.length } });
      return applied;
    } catch (err) {
      const failed: FileTransaction = { ...transaction, status: 'failed', error: (err as Error).message };
      this.transactions.set(transactionId, failed);
      this.emit({ type: 'file.transaction.failed', at: new Date().toISOString(), workspaceId: workspace.id, data: { transactionId, error: (err as Error).message } });
      throw err;
    }
  }

  async rollbackTransaction(transactionId: string): Promise<FileTransaction> {
    const transaction = this.transaction(transactionId);
    if (transaction.status !== 'applied') throw badRequest(`Only applied transactions can be rolled back (status: ${transaction.status})`);
    const snapshot = this.snapshots.get(transactionId);
    const provider = this.provider(transaction.workspaceId);
    if (snapshot && provider.restore) {
      await provider.restore(snapshot);
    }
    const rolledBack: FileTransaction = { ...transaction, status: 'rolled-back' };
    this.transactions.set(transactionId, rolledBack);
    this.emit({ type: 'file.transaction.rolled-back', at: new Date().toISOString(), workspaceId: transaction.workspaceId, data: { transactionId } });
    return rolledBack;
  }

  versions(workspaceId: string, path: string): readonly FileVersionRecord[] {
    return this.versionRecords.get(`${workspaceId}:${path}`) ?? [];
  }

  events(): readonly FileEvent[] {
    return [...this.emitted].sort((a, b) => a.at.localeCompare(b.at));
  }

  // ── internals ─────────────────────────────────────────────

  private workspace(workspaceId: string): FileWorkspace {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) throw badRequest(`Workspace "${workspaceId}" not mounted`);
    return workspace;
  }

  private sandbox(workspaceId: string): WorkspaceSandbox {
    return new WorkspaceSandbox(this.workspace(workspaceId));
  }

  private provider(workspaceId: string): FileProviderPort {
    return this.providers[this.workspace(workspaceId).providerId]!;
  }

  private transaction(transactionId: string): FileTransaction {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) throw badRequest(`File transaction "${transactionId}" not found`);
    return transaction;
  }

  private recordVersion(transaction: FileTransaction, op: FileOperation, principalId: string): void {
    const key = `${transaction.workspaceId}:${op.path}`;
    const list = this.versionRecords.get(key) ?? [];
    const previous = list[list.length - 1];
    const record: FileVersionRecord = {
      revision: list.length + 1,
      path: op.path,
      currentHash: hashOf(op.content ?? ''),
      operationId: transaction.id,
      principalId,
      timestamp: new Date().toISOString(),
      ...(previous !== undefined ? { previousHash: previous.currentHash } : {}),
    };
    list.push(record);
    this.versionRecords.set(key, list);
  }

  private emit(event: FileEvent): void {
    this.emitted.push(event);
  }
}

function hashOf(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
