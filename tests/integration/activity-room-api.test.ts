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

describe('activity room API', () => {
  it('exposes a unified execution snapshot', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/activity-room/snapshot' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      generatedAt?: string;
      counts?: { agents: number; agentRuns: number; approvals: number; workflows: number; workflowRuns: number };
      timeline?: readonly { kind: string }[];
      verification?: { result?: string } | null;
    };

    expect(body.generatedAt).toEqual(expect.any(String));
    expect(body.counts?.agents).toBeGreaterThanOrEqual(0);
    expect(body.counts?.agentRuns).toBeGreaterThanOrEqual(0);
    expect(body.counts?.approvals).toBeGreaterThanOrEqual(0);
    expect(body.counts?.workflows).toBeGreaterThanOrEqual(0);
    expect(body.counts?.workflowRuns).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(body.timeline)).toBe(true);
    if (body.verification !== null && body.verification !== undefined) {
      expect(['pass', 'fail', 'indeterminate']).toContain(body.verification.result);
    }
  });

  it('previews a governed execution plan', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/activity-room/preview',
      payload: { goal: 'Build the Theme Builder', agentId: 'vestara-developer', principalId: 'console-user' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      executionId?: string;
      status?: string;
      summary?: string;
      intent?: { kind?: string; target?: string; complexity?: string };
      capabilities?: readonly { namespace: string }[];
      milestones?: readonly { title: string; steps: readonly { operation: string; requiresApproval: boolean }[] }[];
      evidence?: readonly string[];
    };

    expect(body.executionId).toEqual(expect.any(String));
    expect(body.status).toBe('planning');
    expect(body.summary).toContain('Theme Builder');
    expect(body.intent?.kind).toBe('build');
    expect(body.intent?.target).toBe('Theme Builder');
    expect(body.intent?.complexity).toBe('complex');
    expect(body.capabilities?.map((capability) => capability.namespace)).toEqual(expect.arrayContaining(['workflows', 'tasks', 'generator', 'verification']));
    expect(body.milestones?.some((milestone) => milestone.steps.some((step) => step.operation === 'workflow.create'))).toBe(true);
    expect(body.milestones?.some((milestone) => milestone.steps.some((step) => step.requiresApproval))).toBe(true);
    expect(body.evidence).toEqual(expect.arrayContaining(['workflow definition', 'preview diff', 'apply record', 'verification report']));

    const drafts = await app.inject({ method: 'GET', url: '/api/v2/activity-room/executions' });
    expect(drafts.statusCode).toBe(200);
    const list = drafts.json() as readonly { id?: string; status?: string; request?: { goal?: string } }[];
    expect(list.some((entry) => entry.id === body.executionId)).toBe(true);
    expect(list.some((entry) => entry.request?.goal === 'Build the Theme Builder')).toBe(true);
    expect(list.some((entry) => entry.status === 'planning')).toBe(true);

    const snapshot = await app.inject({ method: 'GET', url: '/api/v2/activity-room/snapshot' });
    expect(snapshot.statusCode).toBe(200);
    const snapshotBody = snapshot.json() as { timeline?: readonly { kind?: string }[] };
    expect(snapshotBody.timeline?.some((item) => item.kind === 'execution')).toBe(true);

    const config = loadConfig({});
    const reloadedApp = await buildApp({ config, application: createApplication(config) });
    await reloadedApp.ready();
    try {
      const persisted = await reloadedApp.inject({ method: 'GET', url: '/api/v2/activity-room/executions' });
      expect(persisted.statusCode).toBe(200);
      const persistedList = persisted.json() as readonly { id?: string; status?: string; request?: { goal?: string } }[];
      expect(persistedList.some((entry) => entry.id === body.executionId)).toBe(true);
      expect(persistedList.some((entry) => entry.request?.goal === 'Build the Theme Builder')).toBe(true);
    } finally {
      await reloadedApp.close();
    }
  });

  it('records and recovers durable Activity history across restarts', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/activity-room/preview',
      payload: { goal: 'Add a CLI command that shows DEX runtime status', agentId: 'vestara-developer' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { executionId?: string };

    const historyRes = await app.inject({ method: 'GET', url: '/api/v2/activity-room/history' });
    expect(historyRes.statusCode).toBe(200);
    const history = historyRes.json() as readonly { executionId?: string; goal?: string; complexity?: string; status?: string }[];
    expect(history.some((entry) => entry.executionId === body.executionId)).toBe(true);
    expect(history.some((entry) => entry.goal === 'Add a CLI command that shows DEX runtime status')).toBe(true);
    expect(history.some((entry) => entry.complexity === 'standard')).toBe(true);

    const eventsRes = await app.inject({ method: 'GET', url: `/api/v2/activity-room/history/${body.executionId}/events` });
    expect(eventsRes.statusCode).toBe(200);
    const events = eventsRes.json() as readonly { sequence?: number; type?: string }[];
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]?.type).toBe('execution-requested');
    expect(events[0]?.sequence).toBe(1);

    const projectionRes = await app.inject({ method: 'GET', url: `/api/v2/activity-room/history/${body.executionId}` });
    expect(projectionRes.statusCode).toBe(200);
    const projection = projectionRes.json() as { executionId?: string; goal?: string; status?: string };
    expect(projection.executionId).toBe(body.executionId);
    expect(projection.goal).toBe('Add a CLI command that shows DEX runtime status');

    // Restart the API — durable history must survive.
    const config = loadConfig({});
    const reloadedApp = await buildApp({ config, application: createApplication(config) });
    await reloadedApp.ready();
    try {
      const recoveredEvents = await reloadedApp.inject({ method: 'GET', url: `/api/v2/activity-room/history/${body.executionId}/events` });
      expect(recoveredEvents.statusCode).toBe(200);
      const recovered = recoveredEvents.json() as readonly { sequence?: number; type?: string }[];
      expect(recovered.some((event) => event.type === 'execution-requested')).toBe(true);

      const recoveredProjection = await reloadedApp.inject({ method: 'GET', url: `/api/v2/activity-room/history/${body.executionId}` });
      expect(recoveredProjection.statusCode).toBe(200);
    } finally {
      await reloadedApp.close();
    }
  });
});
