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

describe('milestone control API (MS-012)', () => {
  it('exposes the milestones capability', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.json().capabilities).toContain('milestones');
  });

  it('creates a milestone, adds tasks and derives progress', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v2/milestones',
      payload: { id: 'M1', title: 'M1', objective: 'ship it' },
    });
    expect(create.statusCode).toBe(201);

    await app.inject({ method: 'POST', url: '/api/v2/tasks', payload: { id: 'T1', title: 'T1', type: 'implementation', milestoneId: 'M1' } });
    const added = await app.inject({ method: 'POST', url: '/api/v2/milestones/M1/tasks', payload: { taskId: 'T1' } });
    expect(added.json().taskIds).toContain('T1');

    const progress = await app.inject({ method: 'GET', url: '/api/v2/milestones/M1/progress' });
    expect(progress.json().totalTasks).toBe(1);

    const health = await app.inject({ method: 'GET', url: '/api/v2/milestones/M1/health' });
    expect(['healthy', 'at_risk', 'blocked', 'unknown']).toContain(health.json().health);
  });

  it('verifies and completes a milestone through the evidence gate', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v2/milestones',
      payload: { id: 'M2', title: 'M2', objective: 'x', successCriteria: [{ id: 'c1', description: 'c1', satisfied: true }], evidenceRequirements: [{ id: 'e1', description: 'e1', evidenceId: 'ev_1' }] },
    });
    await app.inject({ method: 'POST', url: '/api/v2/tasks', payload: { id: 'T2', title: 'T2', type: 'implementation', milestoneId: 'M2' } });
    await app.inject({ method: 'POST', url: '/api/v2/milestones/M2/tasks', payload: { taskId: 'T2' } });
    await app.inject({ method: 'POST', url: '/api/v2/tasks/T2/transition', payload: { status: 'ready' } });
    await app.inject({ method: 'POST', url: '/api/v2/tasks/T2/transition', payload: { status: 'in_progress' } });
    await app.inject({ method: 'POST', url: '/api/v2/tasks/T2/results', payload: { outcome: 'success', summary: 'x', evidenceIds: ['ev_2'] } });

    const verify = await app.inject({ method: 'POST', url: '/api/v2/milestones/M2/verify' });
    expect(verify.json().ok).toBe(true);

    const complete = await app.inject({ method: 'POST', url: '/api/v2/milestones/M2/complete' });
    expect(complete.statusCode).toBe(200);
    expect(complete.json().status).toBe('completed');
  });
});
