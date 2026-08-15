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

describe('OS control API (OS-038)', () => {
  it('captures the current OS profile', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/os/current' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.profile.identity.hostname).toBeTruthy();
    expect(body.lifecycle.state).toBeTruthy();
  });

  it('declares desired state and computes diff + plan', async () => {
    const current = await app.inject({ method: 'GET', url: '/api/v2/os/current' });
    const profile = current.json().profile;

    const declare = await app.inject({
      method: 'PUT',
      url: '/api/v2/os/desired',
      payload: { ...profile, locale: { ...profile.locale, timezone: 'Asia/Manila' } },
    });
    expect(declare.statusCode).toBe(200);
    expect(declare.json().revision).toBe(1);

    const diff = await app.inject({ method: 'GET', url: '/api/v2/os/diff' });
    expect(diff.statusCode).toBe(200);
    expect(diff.json().driftCount).toBeGreaterThan(0);
    expect(diff.json().entries.some((e: { key: string }) => e.key === 'locale.timezone')).toBe(true);

    const plan = await app.inject({ method: 'GET', url: '/api/v2/os/plan' });
    expect(plan.statusCode).toBe(200);
    expect(plan.json().changes.length).toBeGreaterThan(0);

    const state = await app.inject({ method: 'GET', url: '/api/v2/os/state' });
    expect(state.json().driftCount).toBeGreaterThan(0);
  });

  it('lists OS capabilities', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/os/capabilities' });
    expect(res.statusCode).toBe(200);
    const caps = res.json();
    expect(caps.some((c: { id: string }) => c.id === 'os.inspect')).toBe(true);
    expect(caps.some((c: { id: string }) => c.id === 'os.update.apply')).toBe(true);
    const install = caps.find((c: { id: string }) => c.id === 'os.package.install')!;
    expect(install.requiresApproval).toBe(true);
  });

  it('reports 404 before any desired profile is declared', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/os/desired' });
    expect(res.statusCode).toBe(404);
  });
});
