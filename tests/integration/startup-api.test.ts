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

describe('startup control API (DESK-008)', () => {
  it('exposes the startup capability and coordinator', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.json().capabilities).toContain('startup');
    expect(app.application.startup).toBeDefined();
  });

  it('returns a startup snapshot with services and progress', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/startup' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.state.status).toBe('booting');
    expect(body.services.length).toBeGreaterThan(0);
    expect(body.progress).toBeDefined();
  });

  it('reports state + routing destination', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/startup/state' });
    expect(res.json().destination).toBeDefined();
  });

  it('updates service readiness and reflects it in progress', async () => {
    await app.inject({ method: 'POST', url: '/api/v2/startup/services/system/readiness', payload: { readiness: 'ready' } });
    const snapshot = await app.inject({ method: 'GET', url: '/api/v2/startup' });
    const system = snapshot.json().services.find((s: { serviceId: string }) => s.serviceId === 'system');
    expect(system.readiness).toBe('ready');
    expect(snapshot.json().progress.totalCount).toBeGreaterThan(0);
  });

  it('rejects an invalid transition with 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v2/startup/transition', payload: { to: 'ready' } });
    expect(res.statusCode).toBe(400); // cannot jump to ready from booting
  });
});
