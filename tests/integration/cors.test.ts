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

const CROSS_ORIGIN = 'http://localhost:5175';

describe('CORS', () => {
  it('serves access-control headers on cross-origin requests', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system', headers: { origin: CROSS_ORIGIN } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(CROSS_ORIGIN);
  });

  it('answers preflight OPTIONS with allow methods and headers', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/v2/image/profiles',
      headers: { origin: CROSS_ORIGIN, 'access-control-request-method': 'GET' },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(CROSS_ORIGIN);
    expect(res.headers['access-control-allow-methods']).toContain('GET');
    expect(res.headers['access-control-allow-headers']).toContain('Authorization');
  });
});
