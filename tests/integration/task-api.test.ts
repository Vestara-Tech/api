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

describe('task control API (TASK-013)', () => {
  it('exposes the tasks capability', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.json().capabilities).toContain('tasks');
  });

  it('creates, assigns and transitions a task', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v2/tasks',
      payload: { id: 'T1', title: 'Build API', type: 'implementation', priority: 'high' },
    });
    expect(create.statusCode).toBe(201);
    expect(create.json().status).toBe('draft');

    const assign = await app.inject({ method: 'POST', url: '/api/v2/tasks/T1/assign', payload: { assignee: 'dev-1' } });
    expect(assign.json().assignee).toBe('dev-1');

    const transition = await app.inject({ method: 'POST', url: '/api/v2/tasks/T1/transition', payload: { status: 'ready' } });
    expect(transition.statusCode).toBe(200);
    expect(transition.json().status).toBe('ready');

    const list = await app.inject({ method: 'GET', url: '/api/v2/tasks' });
    expect(list.json().map((t: { id: string }) => t.id)).toContain('T1');
  });

  it('records a result and completes the task (evidence-gated)', async () => {
    await app.inject({ method: 'POST', url: '/api/v2/tasks', payload: { id: 'T2', title: 'T2', type: 'implementation' } });
    await app.inject({ method: 'POST', url: '/api/v2/tasks/T2/transition', payload: { status: 'ready' } });
    await app.inject({ method: 'POST', url: '/api/v2/tasks/T2/transition', payload: { status: 'in_progress' } });

    const result = await app.inject({
      method: 'POST',
      url: '/api/v2/tasks/T2/results',
      payload: { outcome: 'success', summary: 'done', evidenceIds: ['ev_1'] },
    });
    expect(result.statusCode).toBe(200);
    expect(result.json().outcome).toBe('success');

    const task = await app.inject({ method: 'GET', url: '/api/v2/tasks/T2' });
    expect(task.json().status).toBe('completed');

    const events = await app.inject({ method: 'GET', url: '/api/v2/tasks/events' });
    expect(events.json().some((e: { type: string }) => e.type === 'task.result.recorded')).toBe(true);
  });
});
