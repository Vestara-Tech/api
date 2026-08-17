import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createApplication } from '../../src/bootstrap/application.js';
import { loadConfig } from '../../src/config/schema.js';

let app: Awaited<ReturnType<typeof buildApp>>;

beforeEach(async () => {
  const config = loadConfig({ VESTARA_API_PORT: '0', VESTARA_API_HOST: '127.0.0.1' });
  const application = createApplication(config);
  app = await buildApp({ config, application });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('capabilities routes', () => {
  it('lists registered capabilities', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/capabilities' });
    expect(res.statusCode).toBe(200);

    const capabilities = res.json() as readonly { namespace: string; enabled: boolean }[];
    expect(capabilities.some((capability) => capability.namespace === 'system')).toBe(true);
    expect(capabilities.some((capability) => capability.namespace === 'dashboard')).toBe(true);
  });

  it('lists enabled capability namespaces', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/capabilities/enabled' });
    expect(res.statusCode).toBe(200);

    const namespaces = res.json() as readonly string[];
    expect(namespaces).toContain('system');
    expect(namespaces).toContain('dashboard');
    expect(namespaces).toContain('files');
    expect(namespaces).toContain('config');
    expect(namespaces).toContain('themes');
    expect(namespaces).toContain('templates');
  });
});
