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

describe('Builder Plane v2 session API', () => {
  it('opens, configures, validates and publishes a session', async () => {
    const open = await app.inject({
      method: 'POST',
      url: '/api/v2/builders/sessions',
      payload: { kind: 'api' },
    });
    expect(open.statusCode).toBe(201);
    const { sessionId } = open.json();

    const configure = await app.inject({
      method: 'PATCH',
      url: `/api/v2/builders/sessions/${sessionId}`,
      payload: {
        spec: {
          id: 'products', name: 'Products API', namespace: 'inventory', version: '1.0.0', status: 'draft',
          resources: [{ id: 'product', name: 'product', plural: 'products', fields: [{ id: 'f1', name: 'id', type: 'string' }] }],
          endpoints: [{ id: 'e1', method: 'GET', path: '/products' }],
          policies: [], operations: [], events: [],
          revision: 0, metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        },
      },
    });
    expect(configure.statusCode).toBe(200);
    expect(configure.json().draft.kind).toBe('api');

    const validate = await app.inject({ method: 'POST', url: `/api/v2/builders/sessions/${sessionId}/validate` });
    expect(validate.json().ok).toBe(true);

    const publish = await app.inject({ method: 'POST', url: `/api/v2/builders/sessions/${sessionId}/publish` });
    expect(publish.json().status).toBe('published');

    const sessions = await app.inject({ method: 'GET', url: '/api/v2/builders/sessions' });
    expect(sessions.json().some((s: { sessionId: string }) => s.sessionId === sessionId)).toBe(true);

    const discard = await app.inject({ method: 'DELETE', url: `/api/v2/builders/sessions/${sessionId}` });
    expect(discard.json().discarded).toBe(true);
  });
});
