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

describe('builder wiring', () => {
  it('exposes the builder capability in system status', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.capabilities).toContain('system');
    expect(body.capabilities).toContain('builder');
  });

  it('registers the builder in the application container', async () => {
    expect(app.application.builder).toBeDefined();
    expect(app.application.container.has('builder')).toBe(true);
  });
});
