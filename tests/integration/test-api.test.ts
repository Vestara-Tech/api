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

describe('expanded test control API (TEST-031)', () => {
  it('exposes the tests capability and runners', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.json().capabilities).toContain('tests');

    const runners = await app.inject({ method: 'GET', url: '/api/v2/test/runners' });
    const ids = runners.json().map((r: { id: string }) => r.id);
    expect(ids).toContain('vitest');
    expect(ids).toContain('http');
  });

  it('creates suite/profile and runs under the profile', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v2/test/suites',
      payload: { id: 's1', name: 'Smoke', tests: [{ id: 'u1', name: 'u1', type: 'unit', target: 'module', runnerId: 'vitest', requirements: [], parameters: { outcome: 'pass' }, tags: [] }] },
    });
    await app.inject({ method: 'POST', url: '/api/v2/test/profiles', payload: { id: 'quick', name: 'Quick', types: ['unit'], tags: [] } });

    const run = await app.inject({ method: 'POST', url: '/api/v2/test/runs', payload: { suiteId: 's1', profileId: 'quick' } });
    expect(run.statusCode).toBe(200);
    expect(run.json().summary.total).toBe(1);
    expect(run.json().evidenceId).toBeTruthy();
  });

  it('runs flaky analysis and impact analysis', async () => {
    const flaky = await app.inject({ method: 'GET', url: '/api/v2/test/flaky?testId=u1' });
    expect(flaky.statusCode).toBe(200);

    const impact = await app.inject({
      method: 'POST',
      url: '/api/v2/test/impact',
      payload: { changedArtifacts: ['src/auth/service.ts'], capabilityOf: { 'src/auth/service.ts': ['auth.login'] }, testsOf: { 'auth.login': ['t1'] } },
    });
    expect(impact.statusCode).toBe(200);
    expect(impact.json().affectedCapabilities).toContain('auth.login');
  });
});
