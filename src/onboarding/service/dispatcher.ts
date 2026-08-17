import type { OnboardingOperation } from '../domain/plan.js';

/**
 * ONB-011 — Operation dispatcher.
 *
 * Each module registers a handler for the operation kinds it supports.
 * The execution engine delegates to the registered handler.
 */
export interface OperationDispatchResult {
  readonly ok: boolean;
  readonly output?: Readonly<Record<string, unknown>>;
  readonly error?: { readonly code: string; readonly message: string };
  /** If the operation supports rollback, the handler returns an undo input. */
  readonly rollbackInput?: Readonly<Record<string, unknown>>;
}

export interface OperationHandler {
  readonly kind: string;
  /** Execute the operation. */
  execute(input: Readonly<Record<string, unknown>>, context: unknown): Promise<OperationDispatchResult>;
  /** Attempt to undo a previously completed operation. */
  rollback?(input: Readonly<Record<string, unknown>>, context: unknown): Promise<{ readonly ok: boolean; readonly error?: string }>;
}

export class OperationDispatcher {
  private readonly handlers = new Map<string, OperationHandler>();

  register(handler: OperationHandler): void {
    this.handlers.set(handler.kind, handler);
  }

  has(kind: string): boolean {
    return this.handlers.has(kind);
  }

  async execute(op: OnboardingOperation, context: unknown): Promise<OperationDispatchResult> {
    const handler = this.handlers.get(op.kind);
    if (!handler) {
      return { ok: false, error: { code: 'UNSUPPORTED', message: `No handler for operation kind "${op.kind}"` } };
    }
    return handler.execute(op.input, context);
  }

  async rollback(op: OnboardingOperation, context: unknown): Promise<{ readonly ok: boolean; readonly error?: string }> {
    const handler = this.handlers.get(op.kind);
    if (!handler?.rollback) {
      return { ok: true };
    }
    return handler.rollback(op.input, context);
  }
}
