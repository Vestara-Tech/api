import { hashOf } from '../../generator/domain/hash.js';
import type { OnboardingPlan } from './plan.js';
import type { DeploymentProfileId } from './profile.js';

export interface OnboardingAnswers {
  readonly profile?: DeploymentProfileId;
  readonly owner?: { readonly displayName?: string; readonly email?: string };
  readonly config?: Readonly<Record<string, unknown>>;
  readonly [key: string]: unknown;
}

export type OnboardingSessionStatus = 'draft' | 'planned' | 'approved' | 'executing' | 'completed' | 'failed';

export interface OnboardingSession {
  id: string;
  status: OnboardingSessionStatus;
  answers: OnboardingAnswers;
  approvedPlanId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOnboardingSessionInput {
  readonly id: string;
  readonly answers?: OnboardingAnswers;
}

/**
 * ONB-004 — Onboarding session.
 *
 * Answers are editable until a plan is approved. Once approved the plan is
 * immutable; changing anything produces a NEW plan (new id + new planHash)
 * that requires fresh approval.
 */
export class OnboardingSessionModel {
  private session: OnboardingSession;

  constructor(input: CreateOnboardingSessionInput) {
    const now = new Date().toISOString();
    this.session = {
      id: input.id,
      status: 'draft',
      answers: input.answers ?? {},
      createdAt: now,
      updatedAt: now,
    };
  }

  getSnapshot(): OnboardingSession {
    return { ...this.session };
  }

  setAnswers(answers: OnboardingAnswers): void {
    if (this.session.status === 'approved' || this.session.status === 'executing') {
      throw new Error('Cannot edit answers after plan approval');
    }
    this.session.answers = answers;
    this.session.status = 'draft';
    this.session.updatedAt = new Date().toISOString();
  }

  /** Bind a newly built plan; requires the session be in draft/planned. */
  attachPlan(plan: OnboardingPlan): void {
    if (this.session.status === 'approved' || this.session.status === 'executing') {
      throw new Error('Cannot attach a plan to an approved session');
    }
    this.session.status = 'planned';
    this.session.updatedAt = new Date().toISOString();
  }

  /** Approve the bound plan; the plan becomes immutable. */
  approve(planId: string): void {
    if (this.session.status === 'approved' || this.session.status === 'executing') {
      throw new Error('Session already approved');
    }
    this.session.approvedPlanId = planId;
    this.session.status = 'approved';
    this.session.updatedAt = new Date().toISOString();
  }

  /** Mark executing (used by the execution engine in ONB Phase 3). */
  beginExecution(): void {
    if (this.session.status !== 'approved') {
      throw new Error('Session must be approved before execution');
    }
    this.session.status = 'executing';
    this.session.updatedAt = new Date().toISOString();
  }
}

export { hashOf };
