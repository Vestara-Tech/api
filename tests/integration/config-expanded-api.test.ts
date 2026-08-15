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

describe('expanded config control API (CONFIG-021)', () => {
  it('lists configuration contributions and fields', async () => {
    const contributions = await app.inject({ method: 'GET', url: '/api/v2/config/contributions' });
    expect(contributions.statusCode).toBe(200);
    expect(Array.isArray(contributions.json())).toBe(true);

    const fields = await app.inject({ method: 'GET', url: '/api/v2/config/fields' });
    expect(fields.statusCode).toBe(200);
    expect(Array.isArray(fields.json())).toBe(true);
  });

  it('analyzes operational impact of configuration changes', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/config/impact',
      payload: { changes: [{ key: 'vestara.api.port', from: 4310, to: 7000 }] },
    });
    expect(res.statusCode).toBe(200);
    const impact = res.json();
    expect(impact.affectedModules).toBeDefined();
    expect(typeof impact.risk).toBe('string');
    expect(typeof impact.requiresReboot).toBe('boolean');
  });

  it('creates and lists configuration transactions', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v2/config/transactions',
      payload: { scope: { type: 'workspace' }, changes: [{ key: 'vestara.api.port', from: 4310, to: 7000 }] },
    });
    expect(create.statusCode).toBe(201);
    expect(create.json().status).toBe('draft');

    const list = await app.inject({ method: 'GET', url: '/api/v2/config/transactions' });
    expect(list.json().length).toBeGreaterThan(0);
  });
});
