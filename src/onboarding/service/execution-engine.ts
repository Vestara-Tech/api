import { randomId } from '../../core/identifiers.js';
import type { OnboardingOperation, OnboardingPlan } from '../domain/plan.js';
import type { OnboardingSession } from '../domain/session.js';
import type { OnboardingSessionModel } from '../domain/session.js';
import {
  createExecutionState,
  markRunning,
  markStepStarted,
  markStepCompleted,
  markStepFailed,
  markCompleted,
  markRolledBack,
  computeExecutionEvidence,
  completedOperationsForRollback,
  type ExecutionState,
} from '../domain/execution.js';
import { type OperationDispatcher } from './dispatcher.js';
import type { VerificationPipeline, VerificationResult } from './verification.js';

export interface ExecutionEngineOptions {
  readonly dispatcher: OperationDispatcher;
  readonly verification?: VerificationPipeline;
  /** Default concurrency limit (currently 1 — serial execution). */
  readonly concurrency?: number;
  /** Store for durable execution state (null = in-memory only). */
  readonly store?: ExecutionStorePort;
}

export interface ExecutionStorePort {
  get(executionId: string): Promise<ExecutionState | null>;
  save(state: ExecutionState): Promise<void>;
}

export interface ExecutionSummary {
  readonly executionId: string;
  readonly planId: string;
  readonly status: ExecutionState['status'];
  readonly totalSteps: number;
  readonly completedSteps: number;
  readonly failedSteps: number;
  readonly rolledBackSteps: number;
  readonly evidenceHash?: string;
}

/**
 * ONB-010 — Execution engine.
 *
 * Given an approved plan + session, dispatches operations in dependency order.
 * Supports checkpoint/resume (ONB-012), rollback (ONB-013), and evidence
 * collection (ONB-015).
 */
export class ExecutionEngine {
  private readonly dispatcher: OperationDispatcher;
  private readonly verification: VerificationPipeline | undefined;
  private readonly store: ExecutionStorePort | undefined;

  constructor(options: ExecutionEngineOptions) {
    this.dispatcher = options.dispatcher;
    this.verification = options.verification;
    this.store = options.store;
  }

  /** Start a new execution for the given plan. */
  async execute(
    plan: OnboardingPlan,
    session: OnboardingSessionModel,
    context: unknown,
  ): Promise<ExecutionState> {
    if (!plan.approved) {
      throw new Error('Cannot execute an unapproved plan');
    }

    const executionId = randomId('exec');
    let state = createExecutionState({ executionId, planId: plan.id });
    state = markRunning(state);
    await this.persist(state);

    // Begin session execution
    session.beginExecution();

    state = await this.runSteps(plan.steps, state, context);

    // If a step failed, persist and return immediately — do not mark completed
    if (state.status === 'failed') {
      await this.persist(state);
      return state;
    }

    // Collect evidence
    const evidenceHash = computeExecutionEvidence(state);
    state = markCompleted(state, evidenceHash);

    // Run verification
    if (this.verification) {
      const verification = await this.verification.verify(state, plan, context);
      if (!verification.ok) {
        state = markStepFailed(state, '__verification__', 'VERIFICATION_FAILED', verification.summary);
        await this.persist(state);
        return state;
      }
    }

    await this.persist(state);
    return state;
  }

  /** Resume a previously failed execution from the last checkpoint. */
  async resume(
    executionId: string,
    plan: OnboardingPlan,
    context: unknown,
  ): Promise<ExecutionState> {
    let state = await this.load(executionId);
    if (!state) throw new Error(`Execution ${executionId} not found`);
    if (state.status !== 'failed') throw new Error(`Cannot resume execution in status "${state.status}"`);

    const completedIds = new Set(state.checkpoints.filter((cp) => cp.status === 'completed').map((cp) => cp.operationId));
    const pendingOps = plan.steps.filter((op) => !completedIds.has(op.id));

    state = markRunning({ executionId: state.executionId, planId: state.planId, checkpoints: state.checkpoints, ...(state.startedAt !== undefined ? { startedAt: state.startedAt } : {}), status: 'running' });
    state = await this.runSteps(pendingOps, state, context);

    const evidenceHash = computeExecutionEvidence(state);
    state = markCompleted(state, evidenceHash);

    if (this.verification) {
      const verification = await this.verifyAll(plan, state, context);
      if (!verification.ok) {
        state = markStepFailed(state, '__verification__', 'VERIFICATION_FAILED', verification.summary);
      }
    }

    await this.persist(state);
    return state;
  }

  /** Rollback all completed operations in reverse order (ONB-013). */
  async rollback(
    executionId: string,
    plan: OnboardingPlan,
    context: unknown,
  ): Promise<ExecutionState> {
    let state = await this.load(executionId);
    if (!state) throw new Error(`Execution ${executionId} not found`);

    const completedCps = completedOperationsForRollback(state);
    const opMap = new Map(plan.steps.map((op) => [op.id, op]));

    for (const cp of completedCps) {
      const op = opMap.get(cp.operationId);
      if (!op) continue;
      const result = await this.dispatcher.rollback(op, context);
      if (!result.ok) {
        state = markStepFailed(state, cp.operationId, 'ROLLBACK_FAILED', result.error ?? 'Rollback failed');
        await this.persist(state);
        return state;
      }
    }

    state = markRolledBack(state);
    await this.persist(state);
    return state;
  }

  /** Get current execution state. */
  async getExecution(executionId: string): Promise<ExecutionState | null> {
    return this.load(executionId);
  }

  private async runSteps(ops: readonly OnboardingOperation[], state: ExecutionState, context: unknown): Promise<ExecutionState> {
    let current = state;
    for (const op of ops) {
      current = markStepStarted(current, op.id);
      await this.persist(current);

      const result = await this.dispatcher.execute(op, context);
      if (!result.ok) {
        current = markStepFailed(current, op.id, result.error?.code ?? 'UNKNOWN', result.error?.message ?? 'Unknown error');
        await this.persist(current);
        return current;
      }

      current = markStepCompleted(current, op.id, result.output);
      await this.persist(current);
    }
    return current;
  }

  private async verifyAll(plan: OnboardingPlan, state: ExecutionState, context: unknown): Promise<VerificationResult> {
    if (!this.verification) return { ok: true, steps: [], summary: 'No verification pipeline' };
    return this.verification.verify(state, plan, context);
  }

  private async persist(state: ExecutionState): Promise<void> {
    if (this.store) {
      await this.store.save(state);
    }
  }

  private async load(executionId: string): Promise<ExecutionState | null> {
    if (this.store) {
      return this.store.get(executionId);
    }
    throw new Error('No execution store configured — cannot resume');
  }
}
