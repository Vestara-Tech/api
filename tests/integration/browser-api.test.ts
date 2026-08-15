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

describe('browser control API (BRW)', () => {
  it('exposes the browser capability and runtimes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.json().capabilities).toContain('browser');

    const runtimes = await app.inject({ method: 'GET', url: '/api/v2/browser/runtimes' });
    const ids = runtimes.json().map((r: { id: string }) => r.id);
    expect(ids).toContain('playwright');
    expect(ids).toContain('browser-use');
  });

  it('registers a profile, creates a session and navigates', async () => {
    const profile = await app.inject({
      method: 'POST',
      url: '/api/v2/browser/profiles',
      payload: { id: 'eng', name: 'Engineering', runtime: 'playwright', browser: 'chromium', headless: true },
    });
    expect(profile.statusCode).toBe(201);

    const session = await app.inject({ method: 'POST', url: '/api/v2/browser/sessions', payload: { profileId: 'eng', runtime: 'playwright' } });
    expect(session.statusCode).toBe(201);
    const sessionId = session.json().id;

    const nav = await app.inject({ method: 'POST', url: '/api/v2/browser/navigate', payload: { sessionId, url: 'https://vestara.dev', hasPermission: true } });
    expect(nav.statusCode).toBe(200);
    expect(nav.json().evidence.action).toBe('navigate');

    const sessions = await app.inject({ method: 'GET', url: '/api/v2/browser/sessions' });
    expect(sessions.json().length).toBeGreaterThan(0);

    const evidence = await app.inject({ method: 'GET', url: '/api/v2/browser/evidence' });
    expect(evidence.json().length).toBeGreaterThan(0);
  });

  it('rejects navigation without permission', async () => {
    await app.inject({ method: 'POST', url: '/api/v2/browser/profiles', payload: { id: 'eng', name: 'Engineering', runtime: 'playwright', browser: 'chromium', headless: true } });
    const session = await app.inject({ method: 'POST', url: '/api/v2/browser/sessions', payload: { profileId: 'eng', runtime: 'playwright' } });
    const nav = await app.inject({ method: 'POST', url: '/api/v2/browser/navigate', payload: { sessionId: session.json().id, url: 'https://x', hasPermission: false } });
    expect(nav.statusCode).toBe(500);
  });
});
