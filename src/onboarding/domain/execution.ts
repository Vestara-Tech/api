import { hashOf } from '../../generator/domain/hash.js';
import type { OnboardingOperation } from './plan.js';

// ── ONB-010 Execution state ─────────────────────────────────────────

export type ExecutionStatus =
  | 'idle'
  | 'running'
  | 'awaiting-checkpoint'
  | 'rolled-back'
  | 'completed'
  | 'failed';

export interface ExecutionCheckpoint {
  readonly operationId: string;
  readonly status: 'pending' | 'running' | 'completed' | 'skipped' | 'failed' | 'rolled-back';
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly output?: Readonly<Record<string, unknown>>;
  readonly error?: { readonly code: string; readonly message: string };
}

export interface ExecutionState {
  readonly executionId: string;
  readonly planId: string;
  readonly status: ExecutionStatus;
  readonly currentStep?: string;
  readonly checkpoints: readonly ExecutionCheckpoint[];
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly rolledBackAt?: string;
  readonly error?: { readonly code: string; readonly message: string; readonly operationId: string };
  readonly evidenceHash?: string;
}

export interface CreateExecutionInput {
  readonly executionId: string;
  readonly planId: string;
}

export function createExecutionState(input: CreateExecutionInput): ExecutionState {
  return {
    executionId: input.executionId,
    planId: input.planId,
    status: 'idle',
    checkpoints: [],
  };
}

export function markRunning(state: ExecutionState): ExecutionState {
  return { ...state, status: 'running', startedAt: state.startedAt ?? new Date().toISOString() };
}

export function markStepStarted(state: ExecutionState, operationId: string): ExecutionState {
  const checkpoint: ExecutionCheckpoint = { operationId, status: 'running', startedAt: new Date().toISOString() };
  return { ...state, currentStep: operationId, status: 'running', checkpoints: [...state.checkpoints, checkpoint] };
}

export function markStepCompleted(state: ExecutionState, operationId: string, output?: Readonly<Record<string, unknown>>): ExecutionState {
  const checkpoints = state.checkpoints.map((cp) =>
    cp.operationId === operationId ? { ...cp, status: 'completed' as const, completedAt: new Date().toISOString(), ...(output !== undefined ? { output } : {}) } : cp,
  );
  return { ...state, checkpoints };
}

export function markStepFailed(state: ExecutionState, operationId: string, code: string, message: string): ExecutionState {
  const checkpoints = state.checkpoints.map((cp) =>
    cp.operationId === operationId ? { ...cp, status: 'failed' as const, completedAt: new Date().toISOString(), error: { code, message } } : cp,
  );
  return { ...state, status: 'failed', error: { code, message, operationId }, checkpoints };
}

export function markCompleted(state: ExecutionState, evidenceHash: string): ExecutionState {
  return { ...state, status: 'completed', completedAt: new Date().toISOString(), evidenceHash };
}

export function markRolledBack(state: ExecutionState): ExecutionState {
  const checkpoints = state.checkpoints.map((cp) =>
    cp.status === 'completed' ? { ...cp, status: 'rolled-back' as const } : cp,
  );
  const result: ExecutionState = { executionId: state.executionId, planId: state.planId, status: 'rolled-back', checkpoints, rolledBackAt: new Date().toISOString() };
  return result;
}

/** Compute the evidence hash over the full execution trace. */
export function computeExecutionEvidence(state: ExecutionState): string {
  return hashOf({ executionId: state.executionId, planId: state.planId, checkpoints: state.checkpoints });
}

// ── ONB-013 Rollback support ────────────────────────────────────────

/** Return completed operations in reverse order (for rollback). */
export function completedOperationsForRollback(state: ExecutionState): readonly ExecutionCheckpoint[] {
  return [...state.checkpoints]
    .filter((cp) => cp.status === 'completed')
    .reverse();
}
