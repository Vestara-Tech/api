import { strict as assert } from 'node:assert';
import test from 'node:test';
import { createApplication } from '../../src/bootstrap/application.js';
import { loadConfig } from '../../src/config/schema.js';
import { VestaraApiServer } from '../../src/server.js';
import type { AddressInfo } from 'node:net';

async function withServer<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
  const config = loadConfig({ VESTARA_API_PORT: '0', VESTARA_API_HOST: '127.0.0.1' });
  const application = createApplication(config);
  const server = new VestaraApiServer({
    config,
    logger: application.logger,
    systemStatus: () => application.systemStatus(),
  });
  await server.listen();
  const address = server['server'].address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    return await fn(baseUrl);
  } finally {
    await server.close();
  }
}

test('GET /health/live returns 200 live', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/health/live`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { status: string; service: string };
    assert.equal(body.status, 'live');
    assert.equal(body.service, 'vestara-api');
  });
});

test('GET /health/ready returns 200 ready after listen', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/health/ready`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { status: string };
    assert.equal(body.status, 'ready');
  });
});

test('GET /api/v2/system returns system status with capabilities', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/v2/system`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      service: string;
      apiVersion: string;
      uptimeMs: number;
      capabilities: string[];
    };
    assert.equal(body.service, 'vestara-api');
    assert.equal(body.apiVersion, 'v2');
    assert.ok(body.uptimeMs >= 0);
    assert.ok(body.capabilities.includes('system'));
  });
});

test('GET /api/v2 returns service identity', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/v2`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { service: string; apiVersion: string };
    assert.equal(body.apiVersion, 'v2');
  });
});

test('unknown route returns canonical VestaraError 404', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/v2/nope`);
    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: { code: string; requestId: string; correlationId: string; retryable: boolean } };
    assert.equal(body.error.code, 'NOT_FOUND');
    assert.ok(body.error.requestId.startsWith('req_'));
    assert.equal(body.error.retryable, false);
  });
});

test('request propagates a supplied correlationId', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/v2/nope?correlationId=cor_abc123`);
    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: { correlationId: string } };
    assert.equal(body.error.correlationId, 'cor_abc123');
  });
});
