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

describe('User control API (USR-030)', () => {
  it('provisions, resolves and lists users', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v2/users',
      payload: {
        identityId: 'ident_1',
        username: 'eddie',
        profile: { displayName: 'Eddie Villanueva', jobTitle: 'Developer', organization: 'Vestara-Tech' },
        preferences: { 'ui.theme': 'dark' },
        settings: { emailVerified: true, email: 'eddie@vestara.dev' },
      },
    });
    expect(create.statusCode).toBe(201);
    const user = create.json();
    expect(user.status).toBe('pending');

    const get = await app.inject({ method: 'GET', url: `/api/v2/users/${user.id}` });
    expect(get.json().username).toBe('eddie');

    const byIdentity = await app.inject({ method: 'GET', url: '/api/v2/users/by-identity/ident_1' });
    expect(byIdentity.json().id).toBe(user.id);

    const list = await app.inject({ method: 'GET', url: '/api/v2/users' });
    expect(list.json().length).toBe(1);
  });

  it('transitions lifecycle and updates profile + preferences', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v2/users',
      payload: { identityId: 'ident_2', username: 'maria', profile: { displayName: 'Maria' } },
    });
    const userId = create.json().id;

    const status = await app.inject({
      method: 'PATCH',
      url: `/api/v2/users/${userId}/status`,
      payload: { to: 'active' },
    });
    expect(status.json().status).toBe('active');

    const profile = await app.inject({
      method: 'PATCH',
      url: `/api/v2/users/${userId}/profile`,
      payload: { displayName: 'Maria Reyes', jobTitle: 'Designer' },
    });
    expect(profile.json().profile.displayName).toBe('Maria Reyes');

    const prefs = await app.inject({
      method: 'PATCH',
      url: `/api/v2/users/${userId}/preferences`,
      payload: { 'ai.defaultModel': 'deepseek' },
    });
    expect(prefs.json().preferences['ai.defaultModel']).toBe('deepseek');
  });

  it('manages memberships', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v2/users',
      payload: { identityId: 'ident_3', username: 'carlos', profile: { displayName: 'Carlos' } },
    });
    const userId = create.json().id;

    const add = await app.inject({
      method: 'POST',
      url: `/api/v2/users/${userId}/memberships`,
      payload: { id: 'm1', organizationId: 'org-vestara', roleIds: ['developer'] },
    });
    expect(add.json().memberships).toHaveLength(1);

    const remove = await app.inject({ method: 'DELETE', url: `/api/v2/users/${userId}/memberships/m1` });
    expect(remove.json().memberships).toHaveLength(0);
  });
});
