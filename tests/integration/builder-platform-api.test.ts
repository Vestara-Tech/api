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

describe('Page Builder control API (PAGE-020)', () => {
  it('creates, validates, updates and lists a page', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v2/pages',
      payload: {
        id: 'users',
        name: 'Users',
        route: '/users',
        layout: {
          type: 'header-sidebar-content',
          content: { id: 'n1', component: { definitionId: 'data-grid' }, props: {}, bindings: [], events: [], actions: [], state: [], permissions: [], children: [] },
        },
        nodes: [],
        dataSources: [{ id: 'ds1', source: 'api', operation: 'users.list' }],
        actions: [],
        permissions: [{ id: 'p1', permission: 'users.read', mode: 'show' }],
        responsive: [],
        metadata: { title: 'Users', authRequired: true },
      },
    });
    expect(create.statusCode).toBe(201);
    expect(create.json().revision).toBe(1);

    const validate = await app.inject({ method: 'POST', url: '/api/v2/pages/users/validate' });
    expect(validate.json().ok).toBe(true);

    const update = await app.inject({
      method: 'PATCH',
      url: '/api/v2/pages/users',
      payload: { metadata: { title: 'User Directory', authRequired: true } },
    });
    expect(update.json().revision).toBe(2);
    expect(update.json().metadata.title).toBe('User Directory');

    const list = await app.inject({ method: 'GET', url: '/api/v2/pages' });
    expect(list.json().some((p: { id: string }) => p.id === 'users')).toBe(true);
  });
});

describe('Application Builder control API (APP-024)', () => {
  it('creates an application, transitions lifecycle and resolves the model', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v2/pages',
      payload: {
        id: 'users',
        name: 'Users',
        route: '/users',
        layout: { type: 'single', content: { id: 'n1', component: { definitionId: 'data-grid' }, props: {}, bindings: [], events: [], actions: [], state: [], permissions: [], children: [] } },
        nodes: [], dataSources: [], actions: [], permissions: [], responsive: [],
        metadata: { title: 'Users', authRequired: true },
      },
    });
    expect(create.statusCode).toBe(201);

    const createApp = await app.inject({
      method: 'POST',
      url: '/api/v2/applications',
      payload: {
        id: 'customer-portal', name: 'Customer Portal', version: '1.0.0', applicationType: 'web',
        pages: [{ pageId: 'users', path: '/users' }],
        routes: [{ path: '/users', pageId: 'users', authRequired: true }],
        navigation: [], apis: [], databases: [],
        authentication: { enabled: true, provider: 'vestara' },
        permissions: [], workflows: [], agents: [], configuration: [], integrations: [], state: [],
      },
    });
    expect(createApp.statusCode).toBe(201);
    expect(createApp.json().lifecycle).toBe('draft');

    const transition = await app.inject({
      method: 'POST',
      url: '/api/v2/applications/customer-portal/transition',
      payload: { to: 'planning' },
    });
    expect(transition.json().lifecycle).toBe('planning');

    const model = await app.inject({ method: 'GET', url: '/api/v2/applications/customer-portal/model' });
    expect(model.json().pages.some((p: { id: string }) => p.id === 'users')).toBe(true);
  });

  it('rejects an application with an unknown page reference', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/applications',
      payload: {
        id: 'broken', name: 'Broken', version: '1', applicationType: 'web',
        pages: [], routes: [{ path: '/x', pageId: 'missing', authRequired: false }],
        navigation: [], apis: [], databases: [],
        authentication: { enabled: false, provider: 'vestara' },
        permissions: [], workflows: [], agents: [], configuration: [], integrations: [], state: [],
      },
    });
    expect(res.statusCode).toBe(409);
  });
});
