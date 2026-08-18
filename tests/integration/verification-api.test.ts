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

describe('verification API', () => {
  it('exposes the latest verification report', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/verification/latest' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { result?: string } | null;
    if (body !== null) {
      expect(['pass', 'fail', 'indeterminate']).toContain(body.result);
    }
  });
});
