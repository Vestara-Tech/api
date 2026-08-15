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

describe('diagnostics control API (DIAG-019)', () => {
  it('exposes the diagnostics capability', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.json().capabilities).toContain('diagnostics');
  });

  it('lists registered checks including image-builder', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/diagnostics/checks' });
    expect(res.statusCode).toBe(200);
    const checks = res.json() as { checkId: string; moduleId: string }[];
    expect(checks.some((c) => c.checkId === 'image-builder.profile.load')).toBe(true);
    expect(checks.some((c) => c.checkId === 'system.api.health')).toBe(true);
  });

  it('runs a system diagnostic', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v2/diagnostics/run', payload: { scope: 'system' } });
    expect(res.statusCode).toBe(200);
    const run = res.json();
    expect(['completed', 'partial']).toContain(run.status);
    expect(run.counts).toBeDefined();
  });

  it('runs an image-builder module diagnostic and lists runs', async () => {
    const run = await app.inject({ method: 'POST', url: '/api/v2/diagnostics/run', payload: { scope: 'module', moduleId: 'image-builder' } });
    expect(run.statusCode).toBe(200);
    const result = run.json();
    expect(result.scope).toBe('module');
    const profileCheck = result.findings?.find((f: { checkId: string }) => f.checkId === 'image-builder.profile.load');

    const runs = await app.inject({ method: 'GET', url: '/api/v2/diagnostics/runs' });
    expect(runs.json().length).toBeGreaterThan(0);
  });
});
