import { newOperationId } from './identifiers.js';

export type OperationStatus =
  | 'created'
  | 'queued'
  | 'running'
  | 'waiting'
  | 'blocked'
  | 'cancelled'
  | 'failed'
  | 'completed';

export interface Operation {
  readonly id: string;
  readonly type: string;
  readonly resourceId?: string;
  readonly status: OperationStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly error?: { code: string; message: string };
  readonly progress?: number;
}

export interface CreateOperationInput {
  readonly type: string;
  readonly resourceId?: string;
  readonly status?: OperationStatus;
}

const TERMINAL: readonly OperationStatus[] = ['cancelled', 'failed', 'completed'];

export class OperationStore {
  private readonly operations = new Map<string, Operation>();

  create(input: CreateOperationInput): Operation {
    const now = new Date().toISOString();
    const operation: Operation = {
      id: newOperationId(),
      type: input.type,
      status: input.status ?? 'queued',
      createdAt: now,
      updatedAt: now,
      ...(input.resourceId !== undefined ? { resourceId: input.resourceId } : {}),
    };
    this.operations.set(operation.id, operation);
    return operation;
  }

  get(id: string): Operation | null {
    return this.operations.get(id) ?? null;
  }

  list(): readonly Operation[] {
    return [...this.operations.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  updateStatus(id: string, status: OperationStatus, extra?: { error?: { code: string; message: string }; progress?: number }): Operation | null {
    const operation = this.operations.get(id);
    if (!operation) return null;
    const next: Operation = {
      ...operation,
      status,
      updatedAt: new Date().toISOString(),
      ...(extra?.error !== undefined ? { error: extra.error } : {}),
      ...(extra?.progress !== undefined ? { progress: extra.progress } : {}),
    };
    this.operations.set(id, next);
    return next;
  }

  isTerminal(status: OperationStatus): boolean {
    return TERMINAL.includes(status);
  }
}
