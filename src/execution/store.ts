import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import type { Execution } from './domain/contracts.js';

export interface ExecutionStore {
  get(id: string): Execution | null;
  upsert(execution: Execution): Execution;
  list(roomId?: string): readonly Execution[];
}

export class InMemoryExecutionStore implements ExecutionStore {
  private readonly executions = new Map<string, Execution>();

  get(id: string): Execution | null {
    return this.executions.get(id) ?? null;
  }

  upsert(execution: Execution): Execution {
    this.executions.set(execution.id, execution);
    return execution;
  }

  list(roomId?: string): readonly Execution[] {
    const executions = [...this.executions.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id));
    return roomId !== undefined ? executions.filter((execution) => execution.request.roomId === roomId) : executions;
  }
}

interface FileExecutionStoreState {
  readonly version: 1;
  readonly executions: readonly Execution[];
}

export class FileExecutionStore implements ExecutionStore {
  private readonly executions = new Map<string, Execution>();

  constructor(private readonly filePath: string) {
    this.load();
  }

  get(id: string): Execution | null {
    return this.executions.get(id) ?? null;
  }

  upsert(execution: Execution): Execution {
    this.executions.set(execution.id, execution);
    this.save();
    return execution;
  }

  list(roomId?: string): readonly Execution[] {
    const executions = [...this.executions.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id));
    return roomId !== undefined ? executions.filter((execution) => execution.request.roomId === roomId) : executions;
  }

  private load(): void {
    if (!existsSync(this.filePath)) return;
    try {
      const raw = JSON.parse(readFileSync(this.filePath, 'utf8')) as unknown;
      const executions = Array.isArray(raw)
        ? raw
        : typeof raw === 'object' && raw !== null && 'executions' in raw
          ? (raw as Partial<FileExecutionStoreState>).executions
          : undefined;
      if (!Array.isArray(executions)) return;
      for (const execution of executions) {
        if (!execution || typeof execution !== 'object' || typeof execution.id !== 'string') continue;
        this.executions.set(execution.id, execution as Execution);
      }
    } catch {
      // Ignore malformed local cache and rebuild from fresh execution drafts.
    }
  }

  private save(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const payload: FileExecutionStoreState = { version: 1, executions: this.list() };
    writeFileSync(this.filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }
}
