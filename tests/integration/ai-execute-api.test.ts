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

describe('AI execute API (stream/generate)', () => {
  it('exposes the generate and stream routes', async () => {
    const spec = app.swagger();
    expect(spec.paths['/api/v2/ai/stream']).toBeDefined();
    expect(spec.paths['/api/v2/ai/generate']).toBeDefined();
    expect(spec.paths['/api/v2/approvals']).toBeDefined();
    expect(spec.paths['/api/v2/agent-runs/{id}/events/stream']).toBeDefined();
  });

  it('returns an error event stream when no provider is enabled', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/ai/stream',
      payload: {
        consumer: { type: 'module', id: 'test' },
        model: { provider: 'openai', model: 'gpt-4o' },
        messages: [{ role: 'user', content: 'hi' }],
      },
    });
    // SSE response: body contains an error event.
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('data:');
    expect(res.body).toContain('error');
  });

  it('returns an AI error on generate when no provider is enabled', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/ai/generate',
      payload: {
        consumer: { type: 'module', id: 'test' },
        model: { provider: 'openai', model: 'gpt-4o' },
        messages: [{ role: 'user', content: 'hi' }],
      },
    });
    expect(res.statusCode).toBe(500);
  });
});

describe('approval API', () => {
  it('lists approvals (empty) and rejects unknown approval ids', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/v2/approvals' });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual([]);

    const approve = await app.inject({ method: 'POST', url: '/api/v2/approvals/nope/approve', payload: { principalId: 'user-1' } });
    expect(approve.statusCode).toBe(404);
  });
});

describe('agent run event stream', () => {
  it('streams events for an existing run', async () => {
    const start = await app.inject({
      method: 'POST',
      url: '/api/v2/agent-runs',
      payload: { agentId: 'vestara-developer', goal: 'inspect the API' },
    });
    const runId = start.json().id;

    const stream = await app.inject({ method: 'GET', url: `/api/v2/agent-runs/${runId}/events/stream` });
    expect(stream.statusCode).toBe(200);
    expect(stream.body).toContain('data:');
    expect(stream.body).toContain('started');
  });
});
