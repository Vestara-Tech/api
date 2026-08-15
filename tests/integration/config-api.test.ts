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

describe('config control API (CONFIG-008)', () => {
  it('lists registered configuration namespaces', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/config/schemas' });
    expect(res.statusCode).toBe(200);
    const schemas = res.json();
    expect(schemas.some((s: { namespace: string }) => s.namespace === 'vestara.api')).toBe(true);
    expect(schemas.some((s: { namespace: string }) => s.namespace === 'vestara.auth')).toBe(true);
  });

  it('lists derived leaf keys', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/config/keys' });
    expect(res.statusCode).toBe(200);
    const keys = res.json();
    expect(keys.some((k: { key: string }) => k.key === 'vestara.api.port')).toBe(true);
  });

  it('resolves values with source scope', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/config/resolved' });
    expect(res.statusCode).toBe(200);
    const values = res.json();
    const port = values.find((v: { key: string }) => v.key === 'vestara.api.port');
    expect(port).toBeDefined();
    expect(port.value).toBe(4310);
    expect(port.source).toBe('override'); // seeded in the environment layer
  });

  it('resolves a single key', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/config/resolved/vestara.api.host' });
    expect(res.statusCode).toBe(200);
    expect(res.json().value).toBe('127.0.0.1');
  });

  it('returns 404 for an unknown key', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/config/resolved/vestara.nope' });
    expect(res.statusCode).toBe(404);
  });

  it('draft → validate → apply updates a resolved value', async () => {
    const draftRes = await app.inject({
      method: 'POST',
      url: '/api/v2/config/drafts',
      payload: { scope: 'workspace', values: { 'vestara.api.port': 7000 } },
    });
    expect(draftRes.statusCode).toBe(201);
    const draftId = draftRes.json().id;

    const validateRes = await app.inject({ method: 'POST', url: `/api/v2/config/drafts/${draftId}/validate` });
    expect(validateRes.statusCode).toBe(200);
    expect(validateRes.json().ok).toBe(true);

    const applyRes = await app.inject({ method: 'POST', url: `/api/v2/config/drafts/${draftId}/apply` });
    expect(applyRes.statusCode).toBe(200);

    const resolved = await app.inject({ method: 'GET', url: '/api/v2/config/resolved/vestara.api.port' });
    expect(resolved.json().value).toBe(7000);
    expect(resolved.json().scope).toBe('workspace');
  });

  it('lists revisions and rolls back', async () => {
    const draft = await app.inject({
      method: 'POST',
      url: '/api/v2/config/drafts',
      payload: { scope: 'workspace', values: { 'vestara.api.port': 7000 } },
    });
    const draftId = draft.json().id;
    await app.inject({ method: 'POST', url: `/api/v2/config/drafts/${draftId}/apply` });

    const revisions = await app.inject({ method: 'GET', url: '/api/v2/config/scopes/workspace/revisions' });
    expect(revisions.json()).toHaveLength(1);

    const rollback = await app.inject({ method: 'POST', url: '/api/v2/config/scopes/workspace/rollback' });
    expect(rollback.statusCode).toBe(200);

    const resolved = await app.inject({ method: 'GET', url: '/api/v2/config/resolved/vestara.api.port' });
    expect(resolved.json().value).toBe(4310);
  });

  it('rejects a draft that stores a literal secret', async () => {
    const draft = await app.inject({
      method: 'POST',
      url: '/api/v2/config/drafts',
      payload: { scope: 'system', values: { 'vestara.auth.primarySecret': 'hunter2' } },
    });
    const draftId = draft.json().id;
    const applyRes = await app.inject({ method: 'POST', url: `/api/v2/config/drafts/${draftId}/apply` });
    expect(applyRes.statusCode).toBe(400);
  });

  it('exposes the config capability in system status', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.json().capabilities).toContain('config');
  });
});
