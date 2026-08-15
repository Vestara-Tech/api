import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp, type VestaraFastifyInstance } from '../../src/app.js';
import { createApplication } from '../../src/bootstrap/application.js';
import { loadConfig } from '../../src/config/schema.js';

let app: VestaraFastifyInstance;

beforeEach(async () => {
  const config = loadConfig({ VESTARA_API_PORT: '0', VESTARA_API_HOST: '127.0.0.1' });
  const application = createApplication(config);
  app = await buildApp({ config, application });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('health routes', () => {
  it('GET /health/live returns 200 live', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/live' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'live', service: 'vestara-api' });
  });

  it('GET /health/ready returns 200 ready', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ready', service: 'vestara-api' });
  });
});

describe('system routes', () => {
  it('GET /api/v2 returns service identity', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.apiVersion).toBe('v2');
    expect(body.service).toBe('vestara-api');
  });

  it('GET /api/v2/system returns system status with capabilities', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.service).toBe('vestara-api');
    expect(body.apiVersion).toBe('v2');
    expect(body.uptimeMs).toBeGreaterThanOrEqual(0);
    expect(body.capabilities).toContain('system');
  });
});

describe('error handling', () => {
  it('unknown route returns canonical VestaraError 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/nope' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.requestId).toMatch(/^req_/);
    expect(body.error.retryable).toBe(false);
  });

  it('propagates a supplied correlation id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v2/nope',
      headers: { 'x-correlation-id': 'cor_abc123' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.correlationId).toBe('cor_abc123');
  });

  it('sets correlation headers on success responses', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/live' });
    expect(res.headers['x-request-id']).toMatch(/^req_/);
    expect(res.headers['x-correlation-id']).toBeDefined();
    expect(res.headers['x-trace-id']).toMatch(/^trc_/);
  });
});

describe('openapi + docs', () => {
  it('serves generated OpenAPI at /docs/openapi.json', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/openapi.json' });
    expect(res.statusCode).toBe(200);
    const spec = res.json();
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toBe('Vestara API v2');
    expect(spec.paths['/health/live']).toBeDefined();
    expect(spec.paths['/api/v2/system']).toBeDefined();
  });

  it('serves the Scalar docs UI at /docs', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });
});
