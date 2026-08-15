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

describe('login control API', () => {
  it('exposes the login capability and broker', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.json().capabilities).toContain('login');
    expect(app.application.login).toBeDefined();
  });

  it('reports login capabilities', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/login/capabilities' });
    expect(res.statusCode).toBe(200);
    const caps = res.json();
    expect(caps.password).toBe(true);
    expect(caps.recovery).toBe(true);
  });

  it('lists users', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/login/users' });
    expect(res.statusCode).toBe(200);
    expect(res.json().length).toBeGreaterThan(0);
  });

  it('authenticates an OS login (dev adapter accepts any non-empty password)', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v2/login/authenticate', payload: { userId: '1000', method: 'password', secret: 'anything' } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('authenticated');
  });

  it('denies an empty secret with 401', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v2/login/authenticate', payload: { userId: '1000', method: 'password', secret: '' } });
    expect(res.statusCode).toBe(401);
  });

  it('enforces the pre-auth boundary', async () => {
    const allowed = await app.inject({ method: 'POST', url: '/api/v2/login/preauth/check', payload: { capability: 'preauth.power.reboot' } });
    expect(allowed.json().allowed).toBe(true);
    const forbidden = await app.inject({ method: 'POST', url: '/api/v2/login/preauth/check', payload: { capability: 'marketplace' } });
    expect(forbidden.json().allowed).toBe(false);
  });
});
