import { describe, expect, it } from 'vitest';
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
} from '../../src/onboarding/domain/execution.js';
import { OperationDispatcher, type OperationHandler } from '../../src/onboarding/service/dispatcher.js';
import { VerificationPipeline, createReadyStatePolicy } from '../../src/onboarding/service/verification.js';
import { ExecutionEngine } from '../../src/onboarding/service/execution-engine.js';
import { createOnboardingPlan, type OnboardingOperation } from '../../src/onboarding/domain/plan.js';
import { OnboardingSessionModel } from '../../src/onboarding/domain/session.js';

// ── Execution state (ONB-010..013) ──────────────────────────────────

describe('execution state (ONB-010)', () => {
  it('creates idle state', () => {
    const state = createExecutionState({ executionId: 'exec-1', planId: 'plan-1' });
    expect(state.status).toBe('idle');
    expect(state.executionId).toBe('exec-1');
    expect(state.planId).toBe('plan-1');
    expect(state.checkpoints).toEqual([]);
  });

  it('transitions through running → step started → step completed → completed', () => {
    let state = createExecutionState({ executionId: 'exec-2', planId: 'plan-2' });
    state = markRunning(state);
    expect(state.status).toBe('running');
    expect(state.startedAt).toBeDefined();

    state = markStepStarted(state, 'op-1');
    expect(state.currentStep).toBe('op-1');
    expect(state.checkpoints).toHaveLength(1);
    expect(state.checkpoints[0]!.status).toBe('running');

    state = markStepCompleted(state, 'op-1', { installed: true });
    expect(state.checkpoints[0]!.status).toBe('completed');
    expect(state.checkpoints[0]!.output).toEqual({ installed: true });

    state = markCompleted(state, 'evidence-abc');
    expect(state.status).toBe('completed');
    expect(state.evidenceHash).toBe('evidence-abc');
  });

  it('records failure with error details', () => {
    let state = createExecutionState({ executionId: 'exec-3', planId: 'plan-3' });
    state = markRunning(state);
    state = markStepStarted(state, 'op-fail');
    state = markStepFailed(state, 'op-fail', 'INSTALL_FAILED', 'Package not found');
    expect(state.status).toBe('failed');
    expect(state.error).toEqual({ code: 'INSTALL_FAILED', message: 'Package not found', operationId: 'op-fail' });
  });

  it('rolls back completed operations', () => {
    let state = createExecutionState({ executionId: 'exec-4', planId: 'plan-4' });
    state = markRunning(state);
    state = markStepStarted(state, 'op-1');
    state = markStepCompleted(state, 'op-1');
    state = markStepStarted(state, 'op-2');
    state = markStepCompleted(state, 'op-2');
    state = markCompleted(state, 'hash');

    state = markRolledBack(state);
    expect(state.status).toBe('rolled-back');
    expect(state.checkpoints.every((cp) => cp.status === 'rolled-back')).toBe(true);
  });

  it('returns completed operations in reverse order for rollback', () => {
    let state = createExecutionState({ executionId: 'exec-5', planId: 'plan-5' });
    state = markRunning(state);
    state = markStepStarted(state, 'op-1');
    state = markStepCompleted(state, 'op-1');
    state = markStepStarted(state, 'op-2');
    state = markStepCompleted(state, 'op-2');
    state = markStepStarted(state, 'op-3');
    state = markStepFailed(state, 'op-3', 'ERR', 'fail');

    const forRollback = completedOperationsForRollback(state);
    expect(forRollback.map((cp) => cp.operationId)).toEqual(['op-2', 'op-1']);
  });

  it('computes evidence hash', () => {
    let state = createExecutionState({ executionId: 'exec-6', planId: 'plan-6' });
    state = markRunning(state);
    state = markStepStarted(state, 'op-1');
    state = markStepCompleted(state, 'op-1');
    state = markCompleted(state, 'initial');

    const hash = computeExecutionEvidence(state);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });
});

// ── Operation dispatcher (ONB-011) ──────────────────────────────────

describe('operation dispatcher (ONB-011)', () => {
  it('routes operations to registered handlers', async () => {
    const dispatcher = new OperationDispatcher();
    const handler: OperationHandler = {
      kind: 'ai.configure',
      execute: async (input) => ({ ok: true, output: { configured: true, ...input } }),
    };
    dispatcher.register(handler);

    expect(dispatcher.has('ai.configure')).toBe(true);
    expect(dispatcher.has('unknown.kind')).toBe(false);

    const op: OnboardingOperation = { id: 'op-1', kind: 'ai.configure', capability: 'ai', order: 1, input: { provider: 'openai' } };
    const result = await dispatcher.execute(op, {});
    expect(result.ok).toBe(true);
    expect(result.output).toEqual({ configured: true, provider: 'openai' });
  });

  it('returns error for unregistered operation kinds', async () => {
    const dispatcher = new OperationDispatcher();
    const op: OnboardingOperation = { id: 'op-2', kind: 'unknown.kind', capability: 'x', order: 1, input: {} };
    const result = await dispatcher.execute(op, {});
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('UNSUPPORTED');
  });

  it('calls rollback on handlers that support it', async () => {
    const dispatcher = new OperationDispatcher();
    let rolledBack = false;
    const handler: OperationHandler = {
      kind: 'package.install',
      execute: async () => ({ ok: true }),
      rollback: async () => { rolledBack = true; return { ok: true }; },
    };
    dispatcher.register(handler);

    const op: OnboardingOperation = { id: 'op-3', kind: 'package.install', capability: 'marketplace', order: 1, input: {} };
    const result = await dispatcher.rollback(op, {});
    expect(result.ok).toBe(true);
    expect(rolledBack).toBe(true);
  });
});

// ── Verification pipeline (ONB-015) ─────────────────────────────────

describe('verification pipeline (ONB-015)', () => {
  it('returns ok for empty pipeline with no checks', async () => {
    const pipeline = new VerificationPipeline();
    let state = createExecutionState({ executionId: 'e1', planId: 'p1' });
    state = markRunning(state);
    state = markStepStarted(state, 'op-1');
    state = markStepCompleted(state, 'op-1');
    const plan = createOnboardingPlan({ id: 'p1', revision: 1, steps: [{ id: 'op-1', kind: 'config.apply', capability: 'config', order: 1, input: {} }] });
    const result = await pipeline.verify(state, plan, {});
    expect(result.ok).toBe(true);
  });

  it('runs registered checks against completed steps', async () => {
    const pipeline = new VerificationPipeline();
    pipeline.register({
      id: 'check-config',
      label: 'Configuration verified',
      verify: async (_state, op) => op.kind === 'config.apply' ? { ok: true, message: 'looks good' } : { ok: true },
    });

    let state = createExecutionState({ executionId: 'e2', planId: 'p2' });
    state = markRunning(state);
    state = markStepStarted(state, 'op-1');
    state = markStepCompleted(state, 'op-1');
    const plan = createOnboardingPlan({ id: 'p2', revision: 1, steps: [{ id: 'op-1', kind: 'config.apply', capability: 'config', order: 1, input: {} }] });
    const result = await pipeline.verify(state, plan, {});
    expect(result.ok).toBe(true);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]!.ok).toBe(true);
  });
});

// ── Ready-state policy (ONB-016) ────────────────────────────────────

describe('ready-state policy (ONB-016)', () => {
  it('reports not ready when execution is not completed', () => {
    const policy = createReadyStatePolicy('required-completed', []);
    let state = createExecutionState({ executionId: 'e3', planId: 'p3' });
    state = markRunning(state);
    const plan = createOnboardingPlan({ id: 'p3', revision: 1, steps: [] });
    const result = policy.evaluate(state, plan);
    expect(result.ready).toBe(false);
  });

  it('reports ready when all required operations are completed', () => {
    const policy = createReadyStatePolicy('required-completed', ['marketplace']);
    let state = createExecutionState({ executionId: 'e4', planId: 'p4' });
    state = markRunning(state);
    state = markStepStarted(state, 'op-1');
    state = markStepCompleted(state, 'op-1');
    state = markCompleted(state, 'hash');

    const plan = createOnboardingPlan({
      id: 'p4', revision: 1,
      steps: [{ id: 'op-1', kind: 'package.installFromMarketplace', capability: 'marketplace', order: 1, input: {} }],
    });
    const result = policy.evaluate(state, plan);
    expect(result.ready).toBe(true);
  });
});

// ── Execution engine (ONB-010..013 integration) ─────────────────────

describe('execution engine (ONB-010..013)', () => {
  function buildEngine() {
    const dispatcher = new OperationDispatcher();
    const ops: string[] = [];
    const store = new Map<string, import('../../src/onboarding/domain/execution.js').ExecutionState>();

    dispatcher.register({
      kind: 'identity.create',
      execute: async (input) => { ops.push('identity'); return { ok: true, output: { userId: 'u1', ...input } }; },
      rollback: async () => { ops.push('rollback-identity'); return { ok: true }; },
    });
    dispatcher.register({
      kind: 'config.apply',
      execute: async (input) => { ops.push('config'); return { ok: true, output: input }; },
      rollback: async () => { ops.push('rollback-config'); return { ok: true }; },
    });
    dispatcher.register({
      kind: 'capability.enable',
      execute: async () => { ops.push('capability'); return { ok: true }; },
    });

    const engine = new ExecutionEngine({
      dispatcher,
      store: {
        get: async (id) => store.get(id) ?? null,
        save: async (state) => { store.set(state.executionId, state); },
      },
    });
    return { engine, ops };
  }

  const steps: OnboardingOperation[] = [
    { id: 'op-id', kind: 'identity.create', capability: 'auth', order: 1, input: { displayName: 'Admin' } },
    { id: 'op-cfg', kind: 'config.apply', capability: 'config', order: 2, input: { theme: 'dark' } },
    { id: 'op-cap', kind: 'capability.enable', capability: 'generator', order: 3, input: { generatorId: 'gen-1' } },
  ];

  it('executes all steps in order and returns completed state', async () => {
    const { engine, ops } = buildEngine();
    const plan = createOnboardingPlan({ id: 'plan-ex', revision: 1, steps });
    const approved = { ...plan, approved: true };
    const session = new OnboardingSessionModel({ id: 's1' });
    session.attachPlan(plan);
    session.approve(plan.id);

    const state = await engine.execute(approved, session, {});
    expect(state.status).toBe('completed');
    expect(state.checkpoints).toHaveLength(3);
    expect(state.checkpoints.every((cp) => cp.status === 'completed')).toBe(true);
    expect(ops).toEqual(['identity', 'config', 'capability']);
    expect(state.evidenceHash).toBeDefined();
  });

  it('fails fast when an operation fails', async () => {
    const dispatcher = new OperationDispatcher();
    dispatcher.register({
      kind: 'identity.create',
      execute: async () => ({ ok: true }),
    });
    dispatcher.register({
      kind: 'config.apply',
      execute: async () => ({ ok: false, error: { code: 'CONFIG_ERR', message: 'bad config' } }),
    });

    const engine = new ExecutionEngine({ dispatcher });
    const plan = createOnboardingPlan({ id: 'plan-fail', revision: 1, steps: [
      { id: 'op-1', kind: 'identity.create', capability: 'auth', order: 1, input: {} },
      { id: 'op-2', kind: 'config.apply', capability: 'config', order: 2, input: {} },
    ]});
    const approved = { ...plan, approved: true };
    const session = new OnboardingSessionModel({ id: 's2' });
    session.attachPlan(plan);
    session.approve(plan.id);

    const state = await engine.execute(approved, session, {});
    expect(state.status).toBe('failed');
    expect(state.error?.code).toBe('CONFIG_ERR');
    expect(state.checkpoints).toHaveLength(2);
    expect(state.checkpoints[1]!.status).toBe('failed');
  });

  it('rolls back completed operations in reverse order', async () => {
    const { engine, ops } = buildEngine();
    const plan = createOnboardingPlan({ id: 'plan-rb', revision: 1, steps });
    const approved = { ...plan, approved: true };
    const session = new OnboardingSessionModel({ id: 's3' });
    session.attachPlan(plan);
    session.approve(plan.id);

    const execState = await engine.execute(approved, session, {});
    expect(execState.status).toBe('completed');

    const rolledBack = await engine.rollback(execState.executionId, plan, {});
    expect(rolledBack.status).toBe('rolled-back');
    expect(rolledBack.checkpoints.every((cp) => cp.status === 'rolled-back')).toBe(true);
    expect(ops).toContain('rollback-config');
    expect(ops).toContain('rollback-identity');
  });
});
