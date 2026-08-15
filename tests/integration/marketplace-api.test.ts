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

describe('marketplace control API (MKT-023)', () => {
  it('exposes the marketplace capability', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.json().capabilities).toContain('marketplace');
  });

  it('lists packages and categories', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/v2/marketplace/packages' });
    expect(list.statusCode).toBe(200);
    const ids = list.json().map((p: { id: string }) => p.id);
    expect(ids).toContain('com.vestara.github');
    expect(ids).toContain('com.vestara.fullstack-pack');

    const cats = await app.inject({ method: 'GET', url: '/api/v2/marketplace/categories' });
    expect(cats.json().some((c: { name: string }) => c.name === 'integration')).toBe(true);
  });

  it('searches and filters', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/marketplace/packages?search=github' });
    expect(res.json().map((p: { id: string }) => p.id)).toContain('com.vestara.github');
  });

  it('gets package details with permissions and dependencies', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/marketplace/packages/com.vestara.github' });
    expect(res.statusCode).toBe(200);
    const detail = res.json();
    expect(detail.permissions.some((p: { id: string }) => p.id === 'workflow.execute')).toBe(true);
    expect(detail.dependencies[0]!.packageId).toBe('vestara.integration');
  });

  it('installs a low-risk package and lists it as installed', async () => {
    const install = await app.inject({ method: 'POST', url: '/api/v2/marketplace/install', payload: { packageId: 'com.vestara.typescript-skill' } });
    expect(install.statusCode).toBe(200);
    expect(install.json().status).toBe('enabled');

    const installed = await app.inject({ method: 'GET', url: '/api/v2/marketplace/installed' });
    expect(installed.json().some((p: { packageId: string }) => p.packageId === 'com.vestara.typescript-skill')).toBe(true);
  });

  it('requires approval for high-risk packages', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v2/marketplace/install', payload: { packageId: 'com.vestara.github' } });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('APPROVAL_REQUIRED');
  });
});
