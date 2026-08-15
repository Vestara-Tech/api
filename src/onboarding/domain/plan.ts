import { hashOf } from '../../generator/domain/hash.js';

export type OnboardingOperationKind =
  | 'identity.create'
  | 'config.apply'
  | 'generator.apply'
  | 'package.install'
  | 'integration.configure'
  | 'system.configure'
  | 'capability.enable';

export interface OnboardingOperation {
  readonly id: string;
  readonly kind: OnboardingOperationKind;
  readonly capability: string; // owning capability, e.g. 'auth', 'configuration', 'generator'
  readonly order: number;
  readonly input: Readonly<Record<string, unknown>>;
  readonly dependsOn?: readonly string[];
  readonly optional?: boolean;
}

export interface OnboardingWarning {
  readonly code: string;
  readonly message: string;
}

export interface OnboardingRequirement {
  readonly id: string;
  readonly label: string;
  readonly satisfied: boolean;
}

export interface OnboardingPlan {
  readonly id: string;
  readonly revision: number;
  readonly steps: readonly OnboardingOperation[];
  readonly warnings: readonly OnboardingWarning[];
  readonly requirements: readonly OnboardingRequirement[];
  readonly planHash: string;
  readonly approved: boolean;
}

export interface CreateOnboardingPlanInput {
  readonly id: string;
  readonly revision: number;
  readonly steps: readonly OnboardingOperation[];
  readonly warnings?: readonly OnboardingWarning[];
  readonly requirements?: readonly OnboardingRequirement[];
}

/**
 * ONB-009 — Onboarding plan.
 *
 * The plan is immutable once approved. Any edit to the answers produces a new
 * plan with a new revision and a new planHash requiring fresh approval.
 */
export function createOnboardingPlan(input: CreateOnboardingPlanInput): OnboardingPlan {
  const warnings = input.warnings ?? [];
  const requirements = input.requirements ?? [];
  return {
    id: input.id,
    revision: input.revision,
    steps: input.steps,
    warnings,
    requirements,
    planHash: hashOf({
      id: input.id,
      revision: input.revision,
      steps: input.steps,
      warnings,
      requirements,
    }),
    approved: false,
  };
}

export function approveOnboardingPlan(plan: OnboardingPlan): OnboardingPlan {
  return { ...plan, approved: true };
}

export function isPlanApproved(plan: OnboardingPlan): boolean {
  return plan.approved;
}
