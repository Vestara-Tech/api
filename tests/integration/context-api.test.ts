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

describe('context control API (CTX-019)', () => {
  it('exposes the context capability', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.json().capabilities).toContain('context');
  });

  it('lists context providers', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/context/providers' });
    expect(res.statusCode).toBe(200);
    const providers = res.json() as { id: string }[];
    expect(providers.map((p) => p.id)).toContain('agent');
    expect(providers.map((p) => p.id)).toContain('workflow');
  });

  it('collects a context bundle for an agent', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/context/collect',
      payload: { purpose: 'agent-execution', principalId: 'user-1', scope: 'agent', agentId: 'vestara-developer', task: 'implement auth' },
    });
    expect(res.statusCode).toBe(200);
    const bundle = res.json();
    expect(bundle.items.some((i: { source: string }) => i.source === 'instruction')).toBe(true);
    expect(bundle.items.some((i: { source: string }) => i.source === 'task')).toBe(true);
    expect(bundle.budget.availableContextTokens).toBeGreaterThan(0);
  });

  it('snapshots and retrieves a bundle', async () => {
    const collect = await app.inject({
      method: 'POST',
      url: '/api/v2/context/collect',
      payload: { purpose: 'agent-execution', principalId: 'user-1', scope: 'agent', agentId: 'vestara-planner' },
    });
    const bundle = collect.json();
    const snapshot = await app.inject({
      method: 'POST',
      url: '/api/v2/context/snapshots',
      payload: { bundle, runId: 'run_99', agentId: 'vestara-planner' },
    });
    expect(snapshot.statusCode).toBe(201);
    const snap = snapshot.json();
    expect(snap.runId).toBe('run_99');
    expect(snap.bundleHash).toMatch(/^[a-f0-9]{64}$/);

    const get = await app.inject({ method: 'GET', url: `/api/v2/context/snapshots/${snap.id}` });
    expect(get.statusCode).toBe(200);
    expect(get.json().id).toBe(snap.id);

    const list = await app.inject({ method: 'GET', url: '/api/v2/context/snapshots' });
    expect(list.json().length).toBeGreaterThan(0);
  });
});
