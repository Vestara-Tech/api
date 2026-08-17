import type { ExecutionState, ExecutionCheckpoint } from '../domain/execution.js';
import type { OnboardingPlan, OnboardingOperation } from '../domain/plan.js';

/**
 * ONB-015 — Verification pipeline.
 *
 * After each step completes and at the end of an execution, the verification
 * pipeline checks that side effects are observable and that the system is in
 * a valid state.
 */
export interface VerificationStep {
  readonly operationId: string;
  readonly label: string;
  readonly ok: boolean;
  readonly message: string;
}

export interface VerificationResult {
  readonly ok: boolean;
  readonly steps: readonly VerificationStep[];
  readonly summary: string;
}

export interface VerificationCheck {
  readonly id: string;
  readonly label: string;
  verify(state: ExecutionState, operation: OnboardingOperation, context: unknown): Promise<{ ok: boolean; message?: string }>;
}

export class VerificationPipeline {
  private readonly checks = new Map<string, VerificationCheck>();

  register(check: VerificationCheck): void {
    this.checks.set(check.id, check);
  }

  async verify(state: ExecutionState, plan: OnboardingPlan, context: unknown): Promise<VerificationResult> {
    const steps: VerificationStep[] = [];
    const opMap = new Map(plan.steps.map((op) => [op.id, op]));
    const relevantCps = state.checkpoints.filter((cp) => cp.status === 'completed');

    for (const cp of relevantCps) {
      const op = opMap.get(cp.operationId);
      if (!op) continue;
      for (const check of this.checks.values()) {
        try {
          const result = await check.verify(state, op, context);
          steps.push({ operationId: cp.operationId, label: check.label, ok: result.ok, message: result.message ?? 'ok' });
        } catch (error) {
          steps.push({ operationId: cp.operationId, label: check.label, ok: false, message: (error as Error).message });
        }
      }
    }

    const failed = steps.filter((s) => !s.ok);
    return {
      ok: failed.length === 0,
      steps,
      summary: failed.length === 0
        ? `${steps.length} check(s) passed`
        : `${failed.length} of ${steps.length} check(s) failed: ${failed.map((s) => s.label).join(', ')}`,
    };
  }
}

// ── ONB-016 Ready-state policy ──────────────────────────────────────

export type ReadyPolicy = 'all-completed' | 'required-completed' | 'any-completed';

export interface ReadyStatePolicy {
  readonly policy: ReadyPolicy;
  readonly requiredCapabilities: readonly string[];
  evaluate(state: ExecutionState, plan: OnboardingPlan): { ready: boolean; reason: string };
}

export function createReadyStatePolicy(
  policy: ReadyPolicy = 'required-completed',
  requiredCapabilities: readonly string[] = [],
): ReadyStatePolicy {
  return {
    policy,
    requiredCapabilities,
    evaluate(state, plan) {
      if (state.status !== 'completed') {
        return { ready: false, reason: `Execution status is "${state.status}", expected "completed"` };
      }

      const opMap = new Map(plan.steps.map((op) => [op.id, op]));
      const completedIds = new Set(state.checkpoints.filter((cp) => cp.status === 'completed').map((cp) => cp.operationId));
      const requiredOps = plan.steps.filter((op) => requiredCapabilities.includes(op.capability));
      const missingRequired = requiredOps.filter((op) => !completedIds.has(op.id));

      switch (policy) {
        case 'all-completed':
          return { ready: missingRequired.length === 0 && requiredOps.length === plan.steps.length, reason: missingRequired.length === 0 ? 'All steps completed' : `Missing: ${missingRequired.map((op) => op.id).join(', ')}` };
        case 'required-completed':
          return { ready: missingRequired.length === 0, reason: missingRequired.length === 0 ? 'Required capabilities satisfied' : `Missing required: ${missingRequired.map((op) => op.id).join(', ')}` };
        case 'any-completed':
          return { ready: completedIds.size > 0, reason: completedIds.size > 0 ? `${completedIds.size} operation(s) completed` : 'No operations completed yet' };
      }
    },
  };
}
