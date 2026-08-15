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

describe('connectivity contract + diagnostics (IMG-027..030)', () => {
  it('exposes contractVersion for client negotiation', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.contractVersion).toBe('string');
    expect(body.contractVersion.length).toBeGreaterThan(0);
    expect(body.capabilities).toContain('image');
  });

  it('runs image-builder diagnostics with structured checks', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v2/image/diagnostics' });
    expect(res.statusCode).toBe(200);
    const run = res.json();
    expect(run.scope).toBe('module');
    expect(run.counts).toBeDefined();
    expect(Array.isArray(run.checks)).toBe(true);
    const ids = run.checks.map((c: { checkId: string }) => c.checkId);
    expect(ids).toContain('image-builder.api.reachable');
    expect(ids).toContain('image-builder.capability');
    expect(ids).toContain('image-builder.profile.load');
    for (const check of run.checks) {
      expect(typeof check.status).toBe('string');
      expect(typeof check.message).toBe('string');
    }
  });
});
