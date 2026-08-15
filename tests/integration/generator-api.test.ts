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

const input = {
  apiName: 'Products',
  endpoints: [
    { method: 'GET', path: '/products' },
    { method: 'POST', path: '/products' },
  ],
};

describe('generator control API (GEN-011)', () => {
  it('lists generators and capabilities', async () => {
    const gens = await app.inject({ method: 'GET', url: '/api/v2/generator/generators' });
    expect(gens.statusCode).toBe(200);
    expect(gens.json().some((g: { id: string }) => g.id === 'generator.api.typescript')).toBe(true);

    const caps = await app.inject({ method: 'GET', url: '/api/v2/generator/capabilities' });
    expect(caps.json()).toContain('generator.sdk.typescript');
  });

  it('plans without generating', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/generator/plan',
      payload: { generatorId: 'generator.api.typescript', input },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.generatorId).toBe('generator.api.typescript');
    expect(body.requirements.every((r: { satisfied: boolean }) => r.satisfied)).toBe(true);
  });

  it('runs and returns artifacts + evidence', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/generator/run',
      payload: { generatorId: 'generator.api.typescript', input },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.artifacts).toHaveLength(1);
    expect(body.artifacts[0].path).toBe('index.ts');
    expect(body.evidence.generatorId).toBe('generator.api.typescript');
    expect(body.evidence.configurationHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('previews as a diff against a target', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/generator/preview',
      payload: {
        generatorId: 'generator.api.typescript',
        input,
        target: { basePath: '/tmp/gen', existing: [{ path: 'index.ts', content: 'stale content' }] },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.totalFiles).toBe(1);
    expect(body.diff[0].operation).toBe('update');
  });

  it('applies only when approved (400 on validation fail, 403 on unapproved)', async () => {
    const unapproved = await app.inject({
      method: 'POST',
      url: '/api/v2/generator/apply',
      payload: { generatorId: 'generator.api.typescript', input, approved: false },
    });
    expect(unapproved.statusCode).toBe(403);

    const approved = await app.inject({
      method: 'POST',
      url: '/api/v2/generator/apply',
      payload: { generatorId: 'generator.api.typescript', input, approved: true },
    });
    expect(approved.statusCode).toBe(200);
    const body = approved.json();
    expect(body.preview.additions).toBe(1);
    expect(body.apply.appliedFiles).toEqual(['index.ts']);
    expect(body.verification.verified).toBe(true);
    expect(body.validation.ok).toBe(true);
  });

  it('exposes the generator capability with apply op', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.json().capabilities).toContain('generator');
  });
});
