import { describe, expect, it } from 'vitest';
import { canTransitionInstallation, transitionInstallation, createInstallationState, isTerminalInstallation } from '../../src/onboarding/domain/state.js';
import { BootstrapSecurity } from '../../src/onboarding/security/bootstrap.js';
import { OnboardingSessionModel } from '../../src/onboarding/domain/session.js';
import { createOnboardingPlan, approveOnboardingPlan } from '../../src/onboarding/domain/plan.js';

describe('installation state machine (ONB-001)', () => {
  it('follows the happy path uninitialized→bootstrap→planning→awaiting-approval→configuring→verifying→ready', () => {
    expect(canTransitionInstallation('uninitialized', 'bootstrap')).toBe(true);
    expect(canTransitionInstallation('bootstrap', 'planning')).toBe(true);
    expect(canTransitionInstallation('planning', 'awaiting-approval')).toBe(true);
    expect(canTransitionInstallation('awaiting-approval', 'configuring')).toBe(true);
    expect(canTransitionInstallation('configuring', 'verifying')).toBe(true);
    expect(canTransitionInstallation('verifying', 'ready')).toBe(true);
  });

  it('supports failed → retry/resume/rollback', () => {
    expect(canTransitionInstallation('configuring', 'failed')).toBe(true);
    expect(canTransitionInstallation('failed', 'planning')).toBe(true);
    expect(canTransitionInstallation('failed', 'configuring')).toBe(true);
  });

  it('rejects illegal transitions', () => {
    expect(canTransitionInstallation('ready', 'bootstrap')).toBe(false);
    expect(() => transitionInstallation('ready', 'bootstrap')).toThrow();
  });

  it('marks ready as terminal', () => {
    expect(isTerminalInstallation('ready')).toBe(true);
    expect(isTerminalInstallation('failed')).toBe(false);
  });

  it('creates a state with an installation id', () => {
    const state = createInstallationState({ installationId: 'inst-1', onboardingVersion: '1.0.0', status: 'uninitialized' });
    expect(state.installationId).toBe('inst-1');
    expect(state.completedSteps).toEqual([]);
  });
});

describe('bootstrap security (ONB-003)', () => {
  it('issues a token in bootstrap mode and validates it', () => {
    const security = new BootstrapSecurity();
    const creds = security.beginBootstrap();
    expect(creds.enabled).toBe(true);
    expect(creds.token).toMatch(/^boot_/);
    expect(() => security.assertBootstrapToken(creds.token!)).not.toThrow();
    expect(() => security.assertBootstrapToken('wrong')).toThrow();
  });

  it('invalidates irreversibly after completion', () => {
    const security = new BootstrapSecurity();
    const creds = security.beginBootstrap();
    security.completeBootstrap();
    expect(security.isEnabled()).toBe(false);
    expect(() => security.assertBootstrapToken(creds.token!)).toThrow();
    // Cannot re-enable
    expect(() => security.beginBootstrap()).toThrow();
  });

  it('rejects beginning bootstrap twice', () => {
    const security = new BootstrapSecurity();
    security.beginBootstrap();
    expect(() => security.beginBootstrap()).toThrow();
  });
});

describe('onboarding session + plan immutability (ONB-004/009)', () => {
  it('answers are editable until a plan is approved', () => {
    const model = new OnboardingSessionModel({ id: 's1' });
    model.setAnswers({ profile: 'developer' });
    expect(model.getSnapshot().answers.profile).toBe('developer');
  });

  it('a plan cannot be edited once approved', () => {
    const model = new OnboardingSessionModel({ id: 's1' });
    const plan = createOnboardingPlan({
      id: 'p1',
      revision: 1,
      steps: [{ id: 'op1', kind: 'identity.create', capability: 'auth', order: 1, input: {} }],
    });
    model.attachPlan(plan);
    model.approve('p1');
    expect(model.getSnapshot().status).toBe('approved');
    expect(() => model.setAnswers({ profile: 'team' })).toThrow();
    expect(() => model.attachPlan(plan)).toThrow();
  });

  it('an approved plan is immutable and changing it needs a new plan', () => {
    const plan1 = createOnboardingPlan({ id: 'p1', revision: 1, steps: [{ id: 'op1', kind: 'identity.create', capability: 'auth', order: 1, input: {} }] });
    const approved = approveOnboardingPlan(plan1);
    expect(approved.approved).toBe(true);
    expect(approved.planHash).toBe(plan1.planHash);

    // Editing produces a new revision with a new hash.
    const plan2 = createOnboardingPlan({
      id: 'p1',
      revision: 2,
      steps: [{ id: 'op1', kind: 'identity.create', capability: 'auth', order: 1, input: {} }, { id: 'op2', kind: 'config.apply', capability: 'configuration', order: 2, input: {} }],
    });
    expect(plan2.planHash).not.toBe(plan1.planHash);
    expect(plan2.approved).toBe(false);
  });
});
