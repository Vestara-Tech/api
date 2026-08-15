import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createApplication } from '../../src/bootstrap/application.js';
import { loadConfig } from '../../src/config/schema.js';
import { OnboardingSessionModel } from '../../src/onboarding/domain/session.js';

let app: Awaited<ReturnType<typeof buildApp>>;

beforeEach(async () => {
  const config = loadConfig({});
  const application = createApplication(config);
  app = await buildApp({ config, application });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('onboarding wiring (ONB-001..009 checkpoint)', () => {
  it('exposes the onboarding capability and service', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.json().capabilities).toContain('onboarding');
    expect(app.application.onboarding).toBeDefined();
  });

  it('begins onboarding with bootstrap security', async () => {
    const { state, bootstrapToken } = await app.application.onboarding.beginOnboarding();
    expect(state.status).toBe('bootstrap');
    expect(app.application.onboarding.bootstrapStatus().enabled).toBe(true);
    expect(bootstrapToken).toMatch(/^boot_/);
  });

  it('discovers available steps from the real contributors', async () => {
    const steps = await app.application.onboarding.availableSteps();
    const ids = steps.map((s) => s.id);
    // auth, config, generator are all present in this app
    expect(ids).toContain('owner');
    expect(ids).toContain('configuration');
    expect(ids).toContain('generator');
  });

  it('builds a plan for a developer profile and approves it', async () => {
    const model = new OnboardingSessionModel({ id: 'session-1' });
    model.setAnswers({
      owner: { displayName: 'Eddie', email: 'eddie@example.com', password: 'password123' },
      configuration: { 'vestara.api.port': 4310 },
      generator: { generatorIds: ['generator.api.typescript'] },
    });
    const plan = await app.application.onboarding.buildPlan(model);
    expect(plan.steps.length).toBeGreaterThanOrEqual(2);
    expect(plan.requirements.every((r) => r.satisfied)).toBe(true);

    const { session } = await app.application.onboarding.approveAndLock(model, plan);
    expect(session.status).toBe('approved');
    expect(session.approvedPlanId).toBe(plan.id);
  });
});
