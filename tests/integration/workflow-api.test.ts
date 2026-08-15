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

const featureWorkflow = {
  id: 'feature-api',
  name: 'Feature API',
  version: '1.0.0',
  inputs: [{ name: 'feature', type: 'string', required: true }],
  steps: [
    { id: 'plan', kind: 'agent', name: 'Plan', agent: { agentId: 'vestara-planner', objective: 'Plan {{feature}}' } },
    { id: 'read', kind: 'tool', name: 'Read', dependsOn: ['plan'], tool: { toolId: 'api.definition.read' } },
    { id: 'check', kind: 'verification', name: 'Check', dependsOn: ['read'], verification: { requirements: ['{{read}} != ""'], requireEvidence: true } },
  ],
};

describe('workflow control API (WF-015)', () => {
  it('exposes the workflows capability', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.json().capabilities).toContain('workflows');
  });

  it('creates, lists, and publishes a workflow', async () => {
    const create = await app.inject({ method: 'POST', url: '/api/v2/workflows', payload: featureWorkflow });
    expect(create.statusCode).toBe(201);
    expect(create.json().status).toBe('draft');

    const list = await app.inject({ method: 'GET', url: '/api/v2/workflows' });
    expect(list.json().map((w: { id: string }) => w.id)).toContain('feature-api');

    const publish = await app.inject({ method: 'POST', url: '/api/v2/workflows/feature-api/publish' });
    expect(publish.statusCode).toBe(200);
    expect(publish.json().status).toBe('published');
    expect(publish.json().revision).toBe(1);
  });

  it('rejects a cyclic workflow', async () => {
    const cyclic = {
      ...featureWorkflow,
      id: 'cyclic',
      steps: [
        { id: 'a', kind: 'tool', name: 'A', dependsOn: ['b'], tool: { toolId: 'api.definition.read' } },
        { id: 'b', kind: 'tool', name: 'B', dependsOn: ['a'], tool: { toolId: 'api.definition.read' } },
      ],
    };
    const res = await app.inject({ method: 'POST', url: '/api/v2/workflows', payload: cyclic });
    expect(res.statusCode).toBe(400);
  });

  it('starts a run and reads its state and events', async () => {
    await app.inject({ method: 'POST', url: '/api/v2/workflows', payload: featureWorkflow });
    await app.inject({ method: 'POST', url: '/api/v2/workflows/feature-api/publish' });

    const start = await app.inject({
      method: 'POST',
      url: '/api/v2/workflows/feature-api/runs',
      payload: { inputs: { feature: 'orders API' } },
    });
    expect(start.statusCode).toBe(201);
    const runId = start.json().id;

    const detail = await app.inject({ method: 'GET', url: `/api/v2/workflow-runs/${runId}` });
    expect(detail.statusCode).toBe(200);
    expect(['running', 'completed', 'failed', 'waiting']).toContain(detail.json().status);

    const events = await app.inject({ method: 'GET', url: `/api/v2/workflow-runs/${runId}/events` });
    expect(events.statusCode).toBe(200);
    expect(Array.isArray(events.json())).toBe(true);
  });

  it('cancels a run', async () => {
    await app.inject({ method: 'POST', url: '/api/v2/workflows', payload: featureWorkflow });
    await app.inject({ method: 'POST', url: '/api/v2/workflows/feature-api/publish' });
    const start = await app.inject({ method: 'POST', url: '/api/v2/workflows/feature-api/runs', payload: {} });
    const runId = start.json().id;

    const cancel = await app.inject({ method: 'POST', url: `/api/v2/workflow-runs/${runId}/cancel` });
    expect(cancel.statusCode).toBe(200);
    expect(['cancelled', 'completed', 'failed']).toContain(cancel.json().status);
  });
});
