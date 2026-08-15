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

describe('image builder control API (IMG-026)', () => {
  it('exposes the image capability and service', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.json().capabilities).toContain('image');
    expect(app.application.imageBuilder).toBeDefined();
  });

  it('lists built-in profiles', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/image/profiles' });
    expect(res.statusCode).toBe(200);
    const ids = res.json().map((p: { id: string }) => p.id);
    expect(ids).toContain('vestara-desktop');
    expect(ids).toContain('vestara-server');
  });

  it('compiles a build plan', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v2/image/plan', payload: { profileId: 'vestara-desktop', target: 'raw' } });
    expect(res.statusCode).toBe(200);
    const plan = res.json();
    expect(plan.profileId).toBe('vestara-desktop');
    expect(plan.items.length).toBeGreaterThan(10);
    expect(plan.planHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects a build without approval', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v2/image/build', payload: { profileId: 'vestara-desktop', target: 'raw', approved: false } });
    expect(res.statusCode).toBe(403);
  });

  it('runs a governed build to completion', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v2/image/build', payload: { profileId: 'vestara-desktop', target: 'raw', approved: true } });
    expect(res.statusCode).toBe(200);
    const result = res.json();
    expect(result.state.status).toBe('completed');
    expect(result.state.completedStages.length).toBeGreaterThan(10);
    expect(result.evidence.artifactPath).toContain('vestara-os-0.1.0.img');
  });

  it('reports build state', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/image/build/state' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBeDefined();
  });
});
