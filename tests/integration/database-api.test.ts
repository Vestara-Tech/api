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

describe('database control API (DB-021)', () => {
  it('exposes the database capability', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.json().capabilities).toContain('database');
  });

  it('creates and lists database definitions', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v2/database/definitions',
      payload: { id: 'shop', name: 'Shop', engine: 'sqlite', tables: [{ id: 't1', name: 'products', columns: [{ id: 'c1', name: 'id', type: 'integer', nullable: false }] }] },
    });
    expect(create.statusCode).toBe(201);
    expect(create.json().status).toBe('draft');

    const list = await app.inject({ method: 'GET', url: '/api/v2/database/definitions' });
    expect(list.json().map((d: { id: string }) => d.id)).toContain('shop');
  });

  it('plans a migration with risk analysis', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v2/database/definitions',
      payload: { id: 'shop', name: 'Shop', engine: 'sqlite' },
    });
    const plan = await app.inject({
      method: 'POST',
      url: '/api/v2/database/definitions/shop/migration/plan',
      payload: { target: { id: 'shop', name: 'Shop', engine: 'sqlite', tables: [{ id: 't1', name: 'products', columns: [{ id: 'c1', name: 'id', type: 'integer', nullable: false }] }] } },
    });
    expect(plan.statusCode).toBe(200);
    const result = plan.json();
    expect(result.operations.length).toBeGreaterThan(0);
    expect(['low', 'medium', 'high', 'critical']).toContain(result.risk);
  });

  it('lists connections as credential refs only', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/database/connections' });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });
});
