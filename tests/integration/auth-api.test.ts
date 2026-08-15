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

async function seedIdentity(): Promise<{ identityId: string; password: string }> {
  const identity = await app.application.identities.create({
    displayName: 'Eddie',
    primaryEmail: 'eddie@example.com',
    permissions: ['products.read', 'products.delete'],
  });
  const password = 'secret123';
  await app.application.authentication.createPasswordCredential(identity.id, password);
  return { identityId: identity.id, password };
}

describe('auth routes', () => {
  it('login returns a token, session, and identity', async () => {
    const { identityId, password } = await seedIdentity();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/auth/login',
      payload: { identityId, password, device: 'test' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.token).toMatch(/^ses_/);
    expect(body.session.authenticationMethod).toBe('password');
    expect(body.identity.id).toBe(identityId);
  });

  it('login rejects a wrong password with 400', async () => {
    const { identityId } = await seedIdentity();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/auth/login',
      payload: { identityId, password: 'nope' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('/auth/me requires a token and returns the identity', async () => {
    const { identityId, password } = await seedIdentity();
    const login = await app.inject({ method: 'POST', url: '/api/v2/auth/login', payload: { identityId, password } });
    const token = login.json().token;

    const anonymous = await app.inject({ method: 'GET', url: '/api/v2/auth/me' });
    expect(anonymous.statusCode).toBe(401);

    const authed = await app.inject({ method: 'GET', url: '/api/v2/auth/me', headers: { authorization: `Bearer ${token}` } });
    expect(authed.statusCode).toBe(200);
    expect(authed.json().id).toBe(identityId);
  });

  it('logout revokes the session', async () => {
    const { identityId, password } = await seedIdentity();
    const login = await app.inject({ method: 'POST', url: '/api/v2/auth/login', payload: { identityId, password } });
    const token = login.json().token;

    const logout = await app.inject({ method: 'POST', url: '/api/v2/auth/logout', headers: { authorization: `Bearer ${token}` } });
    expect(logout.statusCode).toBe(204);

    const me = await app.inject({ method: 'GET', url: '/api/v2/auth/me', headers: { authorization: `Bearer ${token}` } });
    expect(me.statusCode).toBe(401);
  });

  it('lists sessions and revokes a specific one', async () => {
    const { identityId, password } = await seedIdentity();
    const login = await app.inject({ method: 'POST', url: '/api/v2/auth/login', payload: { identityId, password } });
    const token = login.json().token;

    const sessions = await app.inject({ method: 'GET', url: '/api/v2/auth/sessions', headers: { authorization: `Bearer ${token}` } });
    expect(sessions.statusCode).toBe(200);
    expect(sessions.json()).toHaveLength(1);
    const sessionId = sessions.json()[0].id;

    const revoke = await app.inject({
      method: 'POST',
      url: `/api/v2/auth/sessions/${sessionId}/revoke`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(revoke.statusCode).toBe(204);
  });

  it('checks a permission against the current identity (AUTH-005)', async () => {
    const { identityId, password } = await seedIdentity();
    const login = await app.inject({ method: 'POST', url: '/api/v2/auth/login', payload: { identityId, password } });
    const token = login.json().token;

    const allowed = await app.inject({
      method: 'POST',
      url: '/api/v2/auth/check',
      headers: { authorization: `Bearer ${token}` },
      payload: { permission: 'products.delete' },
    });
    expect(allowed.json().allowed).toBe(true);

    const denied = await app.inject({
      method: 'POST',
      url: '/api/v2/auth/check',
      headers: { authorization: `Bearer ${token}` },
      payload: { permission: 'products.admin' },
    });
    expect(denied.json().allowed).toBe(false);
  });

  it('exposes the auth capability in system status', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.json().capabilities).toContain('auth');
  });
});
