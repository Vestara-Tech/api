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

describe('log control API (LOG-016)', () => {
  it('exposes the logs capability', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.json().capabilities).toContain('logs');
  });

  it('emits, queries, tails and aggregates logs', async () => {
    const emit = await app.inject({
      method: 'POST',
      url: '/api/v2/logs/emit',
      payload: { source: { type: 'api', id: 'vestara-api' }, level: 'error', message: 'boom', attributes: { status: 500 } },
    });
    expect(emit.statusCode).toBe(201);
    expect(emit.json().level).toBe('error');

    const query = await app.inject({ method: 'GET', url: '/api/v2/logs?level=error' });
    expect(query.json().length).toBeGreaterThan(0);

    const tail = await app.inject({ method: 'GET', url: '/api/v2/logs/tail?limit=5' });
    expect(tail.json().length).toBeGreaterThan(0);

    const stats = await app.inject({ method: 'GET', url: '/api/v2/logs/stats' });
    expect(stats.json().byLevel.error).toBeGreaterThan(0);

    const sources = await app.inject({ method: 'GET', url: '/api/v2/logs/sources' });
    expect(sources.json()).toContain('vestara-api');
  });

  it('redacts sensitive attribute values before storage', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v2/logs/emit',
      payload: { source: { type: 'module', id: 'auth' }, level: 'info', message: 'login', attributes: { authorization: 'Bearer abc123' } },
    });
    const query = await app.inject({ method: 'GET', url: '/api/v2/logs?sourceId=auth' });
    const record = query.json()[0]!;
    expect(record.attributes.authorization).toBe('[REDACTED]');
    expect(record.attributes.authorization).not.toContain('abc123');
  });
});
