/** FILE — File Module domain contracts. */

export type FileCapability =
  | 'file.read'
  | 'file.list'
  | 'file.stat'
  | 'file.search'
  | 'file.create'
  | 'file.write'
  | 'file.append'
  | 'file.rename'
  | 'file.move'
  | 'file.copy'
  | 'file.delete'
  | 'directory.create'
  | 'directory.list'
  | 'directory.delete'
  | 'file.version.read'
  | 'file.version.restore'
  | 'file.artifact.create'
  | 'file.artifact.read'
  | 'file.mount.read'
  | 'file.mount.manage'
  | 'file.system.read'
  | 'file.system.write';

export type FileRisk = 'read' | 'low' | 'high' | 'critical';

export const FILE_CAPABILITY_RISK: Readonly<Record<FileCapability, FileRisk>> = {
  'file.read': 'read',
  'file.list': 'read',
  'file.stat': 'read',
  'file.search': 'read',
  'file.create': 'low',
  'file.write': 'low',
  'file.append': 'low',
  'file.rename': 'low',
  'file.move': 'low',
  'file.copy': 'low',
  'file.delete': 'high',
  'directory.create': 'low',
  'directory.list': 'read',
  'directory.delete': 'high',
  'file.version.read': 'read',
  'file.version.restore': 'high',
  'file.artifact.create': 'low',
  'file.artifact.read': 'read',
  'file.mount.read': 'read',
  'file.mount.manage': 'high',
  'file.system.read': 'read',
  'file.system.write': 'critical',
};

export type FileResourceKind = 'file' | 'directory' | 'symlink';

export interface FileResource {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly kind: FileResourceKind;
  readonly workspaceId?: string;
  readonly providerId: string;
  readonly mimeType?: string;
  readonly size?: number;
  readonly hash?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly capabilities: readonly FileCapability[];
}

export interface FileWorkspace {
  readonly id: string;
  readonly name: string;
  readonly root: string;
  readonly providerId: string;
  readonly include?: readonly string[];
  readonly exclude?: readonly string[];
  readonly permissions?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly revision: number;
}

export type FileOperationKind =
  | 'create'
  | 'update'
  | 'append'
  | 'rename'
  | 'move'
  | 'copy'
  | 'delete'
  | 'mkdir';

export interface FileOperation {
  readonly id: string;
  readonly kind: FileOperationKind;
  readonly path: string;
  readonly content?: string;
  readonly destination?: string;
}

export type FileTransactionStatus =
  | 'draft'
  | 'validated'
  | 'awaiting-approval'
  | 'applying'
  | 'applied'
  | 'failed'
  | 'rolled-back';

export interface FileTransaction {
  readonly id: string;
  readonly workspaceId: string;
  readonly operations: readonly FileOperation[];
  readonly status: FileTransactionStatus;
  readonly principalId?: string;
  readonly createdAt: string;
  readonly appliedAt?: string;
  readonly error?: string;
  readonly preview?: readonly FileDiffLine[];
}

export interface FileDiffLine {
  readonly path: string;
  readonly operation: FileOperationKind;
  readonly addedLines: number;
  readonly removedLines: number;
}

export interface FileVersionRecord {
  readonly revision: number;
  readonly path: string;
  readonly previousHash?: string;
  readonly currentHash: string;
  readonly operationId: string;
  readonly principalId: string;
  readonly timestamp: string;
}

export type FileEventType =
  | 'file.created'
  | 'file.updated'
  | 'file.deleted'
  | 'file.moved'
  | 'file.copied'
  | 'directory.created'
  | 'directory.deleted'
  | 'file.transaction.created'
  | 'file.transaction.validated'
  | 'file.transaction.applied'
  | 'file.transaction.failed'
  | 'file.transaction.rolled-back'
  | 'workspace.mounted'
  | 'workspace.unmounted';

export interface FileEvent {
  readonly type: FileEventType;
  readonly at: string;
  readonly workspaceId?: string;
  readonly path?: string;
  readonly data?: unknown;
}

export interface FileSearchQuery {
  readonly pattern: string;
  readonly workspaceId?: string;
  readonly limit?: number;
}
