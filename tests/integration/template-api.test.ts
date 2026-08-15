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

describe('Template control API', () => {
  it('lists built-in templates across kinds', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/templates' });
    expect(res.statusCode).toBe(200);
    const templates = res.json();
    const kinds = new Set(templates.map((t: { kind: string }) => t.kind));
    expect(kinds.has('dashboard')).toBe(true);
    expect(kinds.has('application')).toBe(true);
    expect(kinds.has('agent')).toBe(true);
    expect(kinds.has('os-image')).toBe(true);
  });

  it('lists template kinds', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/templates/kinds' });
    expect(res.json()).toContain('dashboard');
  });

  it('instantiates the engineering dashboard template with parameters + defaults', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/templates/template.dashboard.engineering/instantiate',
      payload: { values: { projectName: 'Vestara Core' }, context: { userName: 'Eddie' } },
    });
    expect(res.statusCode).toBe(200);
    const result = res.json();
    expect(result.definition.name).toBe('Vestara Core Dashboard');
    expect(result.definition.refreshInterval).toBe('30'); // from defaultValue
    expect(result.template.recommendedThemeId).toBe('vestara.dark');
  });

  it('registers a custom template and rejects invalid parameter values', async () => {
    const register = await app.inject({
      method: 'POST',
      url: '/api/v2/templates',
      payload: {
        id: 'custom.page', name: 'Custom Page', version: '1.0.0', kind: 'page',
        tags: [], parameters: [{ name: 'resource', type: 'string', required: true }],
        definition: { title: '{{parameters.resource}}' }, requiredCapabilities: [],
        metadata: { version: '1.0.0', tags: [] },
      },
    });
    expect(register.statusCode).toBe(201);

    const ok = await app.inject({
      method: 'POST',
      url: '/api/v2/templates/custom.page/instantiate',
      payload: { values: { resource: 'Products' } },
    });
    expect(ok.json().definition.title).toBe('Products');

    const bad = await app.inject({
      method: 'POST',
      url: '/api/v2/templates/custom.page/instantiate',
      payload: { values: {} },
    });
    expect(bad.statusCode).toBe(409);
  });
});
