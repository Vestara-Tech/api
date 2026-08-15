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

describe('test control API (TEST-024)', () => {
  it('exposes the tests capability and runners', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.json().capabilities).toContain('tests');

    const runners = await app.inject({ method: 'GET', url: '/api/v2/tests/runners' });
    const ids = runners.json().map((r: { id: string }) => r.id);
    expect(ids).toContain('vitest');
    expect(ids).toContain('http');
  });

  it('creates and runs a suite', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v2/tests/suites',
      payload: {
        id: 's1', name: 'Smoke',
        tests: [
          { id: 'unit1', name: 'unit1', kind: 'unit', target: 'module', runner: 'vitest', configuration: { outcome: 'pass' }, requirements: [], tags: [] },
          { id: 'api1', name: 'api1', kind: 'api', target: 'api', runner: 'http', configuration: { method: 'GET', path: '/health', expectedStatus: 200 }, requirements: [], tags: [] },
        ],
      },
    });
    expect(create.statusCode).toBe(201);

    const run = await app.inject({ method: 'POST', url: '/api/v2/tests/suites/s1/run' });
    expect(run.statusCode).toBe(200);
    const result = run.json();
    expect(result.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.total).toBe(2);
    expect(['completed', 'failed']).toContain(result.status);
  });
});
