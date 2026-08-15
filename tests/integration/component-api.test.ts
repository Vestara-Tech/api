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

describe('component control API (COMP-021)', () => {
  it('lists built-in components with categories and counts', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/components' });
    expect(res.statusCode).toBe(200);
    const components = res.json();
    expect(components.length).toBeGreaterThanOrEqual(7);
    expect(components.some((c: { id: string }) => c.id === 'button')).toBe(true);

    const categories = await app.inject({ method: 'GET', url: '/api/v2/components/categories' });
    expect(categories.statusCode).toBe(200);
    expect(categories.json().length).toBeGreaterThan(0);
  });

  it('resolves a component and reports capability availability', async () => {
    const get = await app.inject({ method: 'GET', url: '/api/v2/components/button' });
    expect(get.statusCode).toBe(200);
    expect(get.json().displayName).toBe('Button');

    const availability = await app.inject({ method: 'GET', url: '/api/v2/components/data-grid/availability' });
    expect(availability.statusCode).toBe(200);
    expect(typeof availability.json().available).toBe('boolean');
  });

  it('searches components', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/components/search?q=grid' });
    expect(res.statusCode).toBe(200);
    expect(res.json().some((c: { id: string }) => c.id === 'data-grid')).toBe(true);
  });

  it('registers a component and lists versions', async () => {
    const register = await app.inject({
      method: 'POST',
      url: '/api/v2/components',
      payload: {
        id: 'custom-chart', packageId: 'example.pkgs', name: 'custom-chart', displayName: 'Custom Chart',
        version: '1.0.0', category: 'chart', renderer: { kind: 'react' },
        properties: [], slots: [], events: [], actions: [],
        capabilities: [], permissions: [], designTokens: [], status: 'published', metadata: {},
      },
    });
    expect(register.statusCode).toBe(201);

    const versions = await app.inject({ method: 'GET', url: '/api/v2/components/custom-chart/versions' });
    expect(versions.json()).toContain('1.0.0');
  });

  it('creates and validates a component tree', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v2/components/trees',
      payload: {
        id: 'tree_dash',
        name: 'Dashboard',
        root: { id: 'n1', definitionId: 'card', definitionVersion: '1.0.0', properties: {}, bindings: [], eventBindings: [], slots: {} },
      },
    });
    expect(create.statusCode).toBe(201);

    const validate = await app.inject({ method: 'POST', url: '/api/v2/components/trees/tree_dash/validate' });
    expect(validate.statusCode).toBe(200);
    expect(validate.json().ok).toBe(true);

    const list = await app.inject({ method: 'GET', url: '/api/v2/components/trees' });
    expect(list.json().some((t: { id: string }) => t.id === 'tree_dash')).toBe(true);
  });
});
