import type { OnboardingContext } from '../service/onboarding-context.js';
import type { OnboardingOperation } from './plan.js';

export interface OnboardingStepDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly capability: string;
  readonly order: number;
  readonly optional: boolean;
}

export interface OnboardingValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export interface OnboardingValidationResult {
  readonly ok: boolean;
  readonly issues: readonly OnboardingValidationIssue[];
}

/**
 * ONB-005 — Onboarding contributor contract.
 *
 * Each platform capability (Authentication, Configuration, Database,
 * Integration, Generator, AI, Marketplace, System) contributes an onboarding
 * step. The UI renders these definitions instead of a fixed 12-page wizard.
 */
export interface OnboardingContributor {
  readonly id: string;
  readonly capability: string;
  readonly order: number;
  readonly optional: boolean;

  isAvailable(context: OnboardingContext): Promise<boolean>;

  describe(context: OnboardingContext): Promise<OnboardingStepDefinition>;

  validate(input: unknown, context: OnboardingContext): Promise<OnboardingValidationResult>;

  plan(input: unknown, context: OnboardingContext): Promise<readonly OnboardingOperation[]>;
}

export class OnboardingStepRegistry {
  private readonly contributors = new Map<string, OnboardingContributor>();

  register(contributor: OnboardingContributor): void {
    if (this.contributors.has(contributor.id)) {
      throw new Error(`Onboarding contributor "${contributor.id}" already registered`);
    }
    this.contributors.set(contributor.id, contributor);
  }

  unregister(id: string): boolean {
    return this.contributors.delete(id);
  }

  has(id: string): boolean {
    return this.contributors.has(id);
  }

  list(): readonly OnboardingContributor[] {
    return [...this.contributors.values()].sort((a, b) => a.order - b.order);
  }

  get(id: string): OnboardingContributor | undefined {
    return this.contributors.get(id);
  }
}
