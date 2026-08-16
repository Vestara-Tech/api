import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createApplication } from '../../src/bootstrap/application.js';
import { loadConfig } from '../../src/config/schema.js';

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

const MANIFEST = {
  provides: [{ kind: 'agent', id: 'developer-agent', name: 'Developer Agent' }],
  requires: [{ module: 'agent', capability: 'agent.runtime' }],
  optional: [{ module: 'browser', capability: 'browser.automation' }],
};

describe('Marketplace v2 control API (MKT2)', () => {
  it('registers a contribution manifest and lists provides', async () => {
    const register = await app.inject({
      method: 'POST',
      url: '/api/v2/marketplace-v2/contributions',
      payload: { packageId: 'developer-pack', version: '1.0.0', manifest: MANIFEST },
    });
    expect(register.statusCode).toBe(201);

    const provides = await app.inject({ method: 'GET', url: '/api/v2/marketplace-v2/provides/agent' });
    expect(provides.json().some((c: { id: string }) => c.id === 'developer-agent')).toBe(true);

    const list = await app.inject({ method: 'GET', url: '/api/v2/marketplace-v2/contributions' });
    expect((list.json() as readonly { packageId: string }[]).some((c) => c.packageId === 'developer-pack')).toBe(true);
  });

  it('resolves capabilities against the platform', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v2/marketplace-v2/resolve', payload: MANIFEST });
    expect(res.statusCode).toBe(200);
    expect(typeof res.json().ok).toBe('boolean');
  });

  it('creates bundles and distributions with an install plan', async () => {
    const bundle = await app.inject({
      method: 'POST',
      url: '/api/v2/marketplace-v2/bundles',
      payload: {
        name: 'Full-Stack Dev',
        packages: [{ packageId: 'developer-agent', required: true }],
        recommended: [{ packageId: 'git-tool' }],
        optional: [],
        ai: ['vestara.coding'],
        metadata: {},
      },
    });
    expect(bundle.statusCode).toBe(201);
    const bundleId = bundle.json().bundleId;

    const distribution = await app.inject({
      method: 'POST',
      url: '/api/v2/marketplace-v2/distributions',
      payload: {
        name: 'Full Stack Development',
        bundles: [{ bundleId, required: true }],
        packages: [{ packageId: 'engineering-workspace', required: true }],
        channel: 'stable',
        curatedBy: 'vestara',
        metadata: {},
      },
    });
    expect(distribution.statusCode).toBe(201);
    const distributionId = distribution.json().distributionId;

    const plan = await app.inject({ method: 'GET', url: `/api/v2/marketplace-v2/distributions/${distributionId}/plan` });
    expect(plan.json().required).toContain('engineering-workspace');
    expect(plan.json().required).toContain('developer-agent');
    expect(plan.json().ai).toContain('vestara.coding');
  });

  it('registers a publisher and publishes a package', async () => {
    const publisher = await app.inject({
      method: 'POST',
      url: '/api/v2/marketplace-v2/publishers',
      payload: { publisherId: 'vestara', name: 'Vestara', trustLevel: 'vestara-official', verified: true, ownerUserId: 'u1' },
    });
    expect(publisher.statusCode).toBe(201);

    const publish = await app.inject({
      method: 'POST',
      url: '/api/v2/marketplace-v2/publish',
      payload: { packageId: 'dev-agent', version: '1.0.0', kind: 'agent', publisherId: 'vestara', buildId: 'b1', securityScanId: 's1', compatibilityHash: 'c1', channel: 'stable' },
    });
    expect(publish.statusCode).toBe(200);
    expect(publish.json().ok).toBe(true);
    expect(publish.json().published.trustLevel).toBe('vestara-official');

    const published = await app.inject({ method: 'GET', url: '/api/v2/marketplace-v2/published' });
    expect(published.json()).toHaveLength(1);
  });
});

describe('Marketplace v2 platform contribution wiring (MKT2-006..010)', () => {
  it('registers live platform modules as distributable contributions at bootstrap', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/v2/marketplace-v2/contributions' });
    expect(list.statusCode).toBe(200);
    const contributions = list.json() as readonly { packageId: string }[];
    const ids = contributions.map((c) => c.packageId);

    expect(ids).toContain('vestara.platform.ai.providers');
    expect(ids).toContain('vestara.platform.ai.profiles');
    expect(ids).toContain('vestara.platform.ai.evaluators');
    expect(ids).toContain('vestara.platform.builders');
    expect(ids).toContain('vestara.platform.generators');
    expect(ids).toContain('vestara.platform.ui.components');
    expect(ids).toContain('vestara.platform.ui.themes');
    expect(ids).toContain('vestara.platform.ui.templates');
    expect(ids).toContain('vestara.platform.image');
  });

  it('exposes platform-provided AI profiles and components through provides', async () => {
    const profiles = await app.inject({ method: 'GET', url: '/api/v2/marketplace-v2/provides/ai-profile' });
    const profileIds = (profiles.json() as readonly { id: string }[]).map((p) => p.id);
    expect(profileIds).toContain('vestara.coding');

    const components = await app.inject({ method: 'GET', url: '/api/v2/marketplace-v2/provides/component' });
    const componentIds = (components.json() as readonly { id: string }[]).map((c) => c.id);
    expect(componentIds).toContain('button');
  });
});

describe('Marketplace v2 version/update/impact API (MKT2-018..020)', () => {
  it('publishes, lists, promotes and evaluates a version', async () => {
    const publish = await app.inject({
      method: 'POST',
      url: '/api/v2/marketplace-v2/versions',
      payload: { packageId: 'dev-agent', version: '1.5.0', channel: 'beta' },
    });
    expect(publish.statusCode).toBe(201);

    const promote = await app.inject({
      method: 'POST',
      url: '/api/v2/marketplace-v2/versions/promote',
      payload: { packageId: 'dev-agent', version: '1.5.0', to: 'stable' },
    });
    expect(promote.json().channel).toBe('stable');

    const list = await app.inject({ method: 'GET', url: '/api/v2/marketplace-v2/versions/dev-agent' });
    expect((list.json() as readonly { version: string }[]).some((v) => v.version === '1.5.0')).toBe(true);

    const evaluate = await app.inject({
      method: 'POST',
      url: '/api/v2/marketplace-v2/updates/evaluate',
      payload: { packageId: 'dev-agent', currentVersion: '1.4.0', latestVersion: '1.5.0', channel: 'stable' },
    });
    expect(evaluate.json().updateAvailable).toBe(true);
    expect(evaluate.json().action).toBe('prompt');
  });

  it('sets an update policy and evaluates accordingly', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v2/marketplace-v2/updates/policy',
      payload: { packageId: 'dev-agent', policy: 'auto', channel: 'stable', blockMajor: true },
    });
    const evaluate = await app.inject({
      method: 'POST',
      url: '/api/v2/marketplace-v2/updates/evaluate',
      payload: { packageId: 'dev-agent', currentVersion: '1.4.0', latestVersion: '2.0.0', channel: 'stable' },
    });
    expect(evaluate.json().action).toBe('hold');
  });

  it('analyzes update impact with reverse dependencies', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/marketplace-v2/impact',
      payload: { packageId: 'vestara.platform.ai.providers', currentVersion: '1.0.0', toVersion: '2.0.0', channel: 'stable' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().packageId).toBe('vestara.platform.ai.providers');
    expect(res.json().toVersion).toBe('2.0.0');
    expect(typeof res.json().breaking).toBe('boolean');
  });
});
