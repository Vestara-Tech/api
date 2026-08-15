import { describe, expect, it } from 'vitest';
import { OnboardingService } from '../../src/onboarding/service/onboarding-service.js';
import { OnboardingSessionModel } from '../../src/onboarding/domain/session.js';
import { authOwnerContributor, configContributor, generatorContributor } from '../../src/onboarding/contributors/builtin.js';
import { discoverEnvironment } from '../../src/onboarding/domain/discovery.js';
import { DEPLOYMENT_PROFILES, getProfile } from '../../src/onboarding/domain/profile.js';
import { CapabilityRegistry } from '../../src/capabilities/registry.js';
import { InMemoryIdentityStore } from '../../src/auth/store/in-memory-identity.js';
import { IdentityService } from '../../src/auth/service/identity-service.js';

function buildContext() {
  const capabilities = new CapabilityRegistry();
  capabilities.register({ id: 'auth', namespace: 'auth', version: '1', permissions: [], operations: [] });
  capabilities.register({ id: 'config', namespace: 'config', version: '1', permissions: [], operations: [] });
  capabilities.register({ id: 'generator', namespace: 'generator', version: '1', permissions: [], operations: [] });
  const identities = new IdentityService({ store: new InMemoryIdentityStore() });
  return { capabilities, identities, configuration: {} as never, generators: { list: () => [] } as never };
}

describe('OnboardingService (ONB-002..009)', () => {
  it('begins onboarding into bootstrap with a token', async () => {
    const context = buildContext();
    const service = new OnboardingService({ context });
    const { state, bootstrapToken } = await service.beginOnboarding();
    expect(state.status).toBe('bootstrap');
    expect(bootstrapToken).toMatch(/^boot_/);
    expect(service.bootstrapSecurity.isEnabled()).toBe(true);
  });

  it('advances installation through the state machine', async () => {
    const context = buildContext();
    const service = new OnboardingService({ context });
    await service.beginOnboarding();
    const planning = await service.advanceInstallation('planning');
    expect(planning.status).toBe('planning');
  });

  it('lists available steps from registered contributors', async () => {
    const context = buildContext();
    const service = new OnboardingService({ context });
    service.registerContributor(authOwnerContributor);
    service.registerContributor(configContributor);
    service.registerContributor(generatorContributor);
    const steps = await service.availableSteps();
    expect(steps.map((s) => s.id)).toEqual(['owner', 'configuration', 'generator']);
  });

  it('builds a plan from contributor operations', async () => {
    const context = buildContext();
    const service = new OnboardingService({ context });
    service.registerContributor(authOwnerContributor);
    service.registerContributor(configContributor);

    const model = new OnboardingSessionModel({ id: 's1' });
    model.setAnswers({
      owner: { displayName: 'Eddie', email: 'eddie@example.com', password: 'password123' },
      configuration: { 'vestara.api.port': 4310 },
    });
    const plan = await service.buildPlan(model);
    expect(plan.steps.map((o) => o.kind)).toEqual(['identity.create', 'config.apply']);
    expect(plan.requirements.every((r) => r.satisfied)).toBe(true);
    expect(plan.planHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('reports unsatisfied requirements when owner input is invalid', async () => {
    const context = buildContext();
    const service = new OnboardingService({ context });
    service.registerContributor(authOwnerContributor);
    const model = new OnboardingSessionModel({ id: 's1' });
    model.setAnswers({ owner: { displayName: '', email: 'bad', password: 'x' } });
    const plan = await service.buildPlan(model);
    expect(plan.requirements.every((r) => r.satisfied)).toBe(false);
    expect(plan.steps).toHaveLength(0);
  });

  it('approving a plan locks the session', async () => {
    const context = buildContext();
    const service = new OnboardingService({ context });
    service.registerContributor(authOwnerContributor);
    const model = new OnboardingSessionModel({ id: 's1' });
    model.setAnswers({ owner: { displayName: 'Eddie', email: 'e@x.com', password: 'password123' } });
    const plan = await service.buildPlan(model);
    const { session } = await service.approveAndLock(model, plan);
    expect(session.status).toBe('approved');
    expect(session.approvedPlanId).toBe(plan.id);
    expect(() => model.setAnswers({ owner: { displayName: 'X' } })).toThrow();
  });

  it('completes bootstrap irreversibly after approval', async () => {
    const context = buildContext();
    const service = new OnboardingService({ context });
    await service.beginOnboarding();
    service.completeBootstrap();
    expect(service.bootstrapStatus().enabled).toBe(false);
  });
});

describe('environment discovery (ONB-006)', () => {
  it('reports platform info and capability presence', async () => {
    const context = buildContext();
    const discovery = await discoverEnvironment(context);
    expect(discovery.hostname.length).toBeGreaterThan(0);
    expect(discovery.nodeVersion).toMatch(/^v/);
    expect(discovery.runtime.authentication).toBe('present');
    expect(discovery.capabilities).toContain('auth');
  });
});

describe('deployment profiles (ONB-007)', () => {
  it('exposes profiles with defaults', () => {
    expect(DEPLOYMENT_PROFILES.map((p) => p.id)).toContain('developer');
    expect(getProfile('server').defaults.serviceIdentities).toBe(true);
    expect(getProfile('server').defaults.hardenedNetworking).toBe(true);
  });
});
