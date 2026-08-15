import { badRequest, conflict } from '../../core/errors.js';
import { BootstrapSecurity } from '../security/bootstrap.js';
import type { InstallationStore } from '../store/installation-store.js';
import { InMemoryInstallationStore } from '../store/installation-store.js';
import { OnboardingStepRegistry, type OnboardingContributor } from '../domain/contributor.js';
import type { InstallationState, InstallationStatus } from '../domain/state.js';
import { createInstallationState, transitionInstallation } from '../domain/state.js';
import type { OnboardingSession, OnboardingAnswers } from '../domain/session.js';
import { OnboardingSessionModel } from '../domain/session.js';
import type { OnboardingStepDefinition } from '../domain/contributor.js';
import type { OnboardingOperation, OnboardingPlan, OnboardingRequirement, OnboardingWarning } from '../domain/plan.js';
import { createOnboardingPlan } from '../domain/plan.js';
import type { OnboardingContext } from './onboarding-context.js';
import { randomId } from '../../core/identifiers.js';

export interface OnboardingServiceOptions {
  readonly store?: InstallationStore;
  readonly context: OnboardingContext;
  readonly onboardingVersion?: string;
}

export interface ApprovedSession {
  readonly session: OnboardingSession;
  readonly plan: OnboardingPlan;
}

export class OnboardingService {
  private readonly store: InstallationStore;
  private readonly context: OnboardingContext;
  private readonly bootstrap: BootstrapSecurity;
  private readonly steps: OnboardingStepRegistry;
  private readonly onboardingVersion: string;

  constructor(options: OnboardingServiceOptions) {
    this.store = options.store ?? new InMemoryInstallationStore();
    this.context = options.context;
    this.bootstrap = new BootstrapSecurity();
    this.steps = new OnboardingStepRegistry();
    this.onboardingVersion = options.onboardingVersion ?? '1.0.0';
  }

  get bootstrapSecurity(): BootstrapSecurity {
    return this.bootstrap;
  }

  get stepRegistry(): OnboardingStepRegistry {
    return this.steps;
  }

  // ── Installation state (ONB-001/002) ───────────────────────

  async installationState(): Promise<InstallationState | null> {
    return this.store.get();
  }

  async beginOnboarding(): Promise<{ state: InstallationState; bootstrapToken: string }> {
    const existing = await this.store.get();
    if (existing && existing.status !== 'failed' && existing.status !== 'uninitialized') {
      throw conflict('Onboarding already in progress or completed');
    }
    const installationId = existing?.installationId ?? randomId('inst');
    const status: InstallationStatus = 'bootstrap';
    const state = createInstallationState({ installationId, onboardingVersion: this.onboardingVersion, status });
    await this.store.save(state);
    const bootstrapToken = this.bootstrap.beginBootstrap().token!;
    return { state, bootstrapToken };
  }

  async advanceInstallation(to: InstallationStatus): Promise<InstallationState> {
    const current = await this.requireState();
    const next: InstallationState = {
      ...current,
      status: transitionInstallation(current.status, to),
      ...(to === 'ready' ? { completedAt: new Date().toISOString() } : {}),
    };
    await this.store.save(next);
    return next;
  }

  // ── Bootstrap security (ONB-003) ───────────────────────────

  assertBootstrapToken(token: string): void {
    this.bootstrap.assertBootstrapToken(token);
  }

  completeBootstrap(): void {
    this.bootstrap.completeBootstrap();
  }

  bootstrapStatus(): { enabled: boolean; tokenPresent: boolean } {
    return this.bootstrap.status();
  }

  // ── Steps / contributors (ONB-005) ─────────────────────────

  registerContributor(contributor: OnboardingContributor): void {
    this.steps.register(contributor);
  }

  async availableSteps(): Promise<OnboardingStepDefinition[]> {
    const out: OnboardingStepDefinition[] = [];
    for (const contributor of this.steps.list()) {
      if (await contributor.isAvailable(this.context)) {
        out.push(await contributor.describe(this.context));
      }
    }
    return out;
  }

  // ── Session (ONB-004) ──────────────────────────────────────

  createSession(answers?: OnboardingAnswers): OnboardingSession {
    const model = new OnboardingSessionModel({
      id: this.bootstrap.newSessionId(),
      ...(answers !== undefined ? { answers } : {}),
    });
    return model.getSnapshot();
  }

  setSessionAnswers(model: OnboardingSessionModel, answers: OnboardingAnswers): void {
    model.setAnswers(answers);
  }

  // ── Planning (ONB-009) ─────────────────────────────────────

  async buildPlan(model: OnboardingSessionModel, revision = 1): Promise<OnboardingPlan> {
    const session = model.getSnapshot();
    const operations: OnboardingOperation[] = [];
    const warnings: OnboardingWarning[] = [];
    const requirements: OnboardingRequirement[] = [];

    for (const contributor of this.steps.list()) {
      if (!(await contributor.isAvailable(this.context))) continue;
      const input = session.answers[contributor.id];
      const validation = await contributor.validate(input, this.context);
      if (!validation.ok) {
        for (const issue of validation.issues.filter((i) => i.severity === 'error')) {
          requirements.push({ id: `${contributor.id}:${issue.path}`, label: issue.message, satisfied: false });
        }
        continue;
      }
      const contributed = await contributor.plan(input, this.context);
      operations.push(...contributed);
    }

    const plan = createOnboardingPlan({
      id: randomId('onbplan'),
      revision,
      steps: operations,
      warnings,
      requirements,
    });
    model.attachPlan(plan);
    return plan;
  }

  /** Approve a plan; the plan becomes immutable (ONB-004). */
  approvePlan(model: OnboardingSessionModel, plan: OnboardingPlan): ApprovedSession {
    model.approve(plan.id);
    return { session: model.getSnapshot(), plan: { ...plan, approved: true } };
  }

  /**
   * Approving a plan locks the session. Bootstrap remains enabled until the
   * execution engine completes the first owner; the installation state is
   * advanced to `awaiting-approval` only when onboarding was started.
   */
  async approveAndLock(model: OnboardingSessionModel, plan: OnboardingPlan): Promise<ApprovedSession> {
    const approved = this.approvePlan(model, plan);
    const state = await this.store.get();
    if (state && state.status !== 'failed') {
      await this.store.save({ ...state, status: 'awaiting-approval' });
    }
    return approved;
  }

  private async requireState(): Promise<InstallationState> {
    const state = await this.store.get();
    if (!state) throw badRequest('Installation not started');
    return state;
  }
}
