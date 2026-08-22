/**
 * ARX-014 — Activity Room governed run route regression.
 *
 * Proves the Activity Room primary action (`POST /api/v2/activity-room/runs`)
 * routes through the DEX/complexity boundary and does NOT invoke the legacy
 * direct AgentRun plane (`POST /api/v2/agent-runs` → AgentRuntime → AI model
 * selection).
 *
 * The configured OpenCode runtime/model is reached through CAR when a SIMPLE
 * goal is routed to the developer path.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createApplication } from '../../src/bootstrap/application.js';
import { loadConfig } from '../../src/config/schema.js';

let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  const config = loadConfig({});
  const application = createApplication(config);
  app = await buildApp({ config, application });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('POST /api/v2/activity-room/runs (governed run)', () => {
  it('routes a SIMPLE goal to the developer path without creating a legacy agent run', async () => {
    const beforeRuns = await app.inject({ method: 'GET', url: '/api/v2/agents/vestara-developer/runs' });
    const beforeCount = (beforeRuns.json() as readonly unknown[]).length;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/activity-room/runs',
      payload: { goal: 'Generate a TypeScript script', principalId: 'console-user' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json() as {
      executionId: string;
      complexity: string;
      route: string;
      status: string;
    };
    expect(body.executionId).toEqual(expect.any(String));
    expect(body.complexity).toBe('simple');
    expect(body.route).toBe('developer');
    expect(body.status).toBe('running');

    // The governed run must NOT appear as a legacy agent run.
    const afterRuns = await app.inject({ method: 'GET', url: '/api/v2/agents/vestara-developer/runs' });
    const afterCount = (afterRuns.json() as readonly unknown[]).length;
    expect(afterCount).toBe(beforeCount);

    // A durable execution fact exists in Activity history (the governed plane).
    const history = await app.inject({ method: 'GET', url: '/api/v2/activity-room/history' });
    const facts = history.json() as readonly { executionId: string; status?: string; complexity?: string }[];
    const fact = facts.find((f) => f.executionId === body.executionId);
    expect(fact).toBeDefined();
    // The routing decision is authoritative: the goal routed to 'developer'.
    expect(body.route).toBe('developer');
  });

  it('routes a COMPLEX goal to a real workflow run with durable correlation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/activity-room/runs',
      payload: { goal: 'Build the Theme Builder', principalId: 'console-user' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json() as {
      executionId: string;
      complexity: string;
      route: string;
      status: string;
      workflowId?: string;
      workflowRunId?: string;
    };
    expect(body.complexity).toBe('complex');
    expect(body.route).toBe('workflow');
    expect(body.status).toBe('running');
    expect(body.workflowId).toBe('vestara-governed-complex');
    expect(body.workflowRunId).toEqual(expect.any(String));

    // A real workflow run exists and is visible in the snapshot.
    const snapshot = await app.inject({ method: 'GET', url: '/api/v2/activity-room/snapshot' });
    expect(snapshot.statusCode).toBe(200);
    const snapshotBody = snapshot.json() as { workflowRuns: readonly { id: string }[]; workflowDefinitions: readonly { id: string }[] };
    expect(snapshotBody.workflowRuns.map((run) => run.id)).toContain(body.workflowRunId);
    expect(snapshotBody.workflowDefinitions.map((def) => def.id)).toContain('vestara-governed-complex');

    // Durable fact + workflow-started event expose the correlation.
    const fact = await app.inject({
      method: 'GET',
      url: `/api/v2/activity-room/history/${body.executionId}`,
    });
    expect(fact.statusCode).toBe(200);
    expect((fact.json() as { complexity?: string; workflowRunId?: string }).complexity).toBe('complex');
    expect((fact.json() as { workflowRunId?: string }).workflowRunId).toBe(body.workflowRunId);

    const events = await app.inject({
      method: 'GET',
      url: `/api/v2/activity-room/history/${body.executionId}/events`,
    });
    expect(events.statusCode).toBe(200);
    const eventTypes = (events.json() as readonly { type: string }[]).map((event) => event.type);
    expect(eventTypes).toContain('workflow-started');
    expect(eventTypes).toContain('workflow-progressed');
  });

  it('retried COMPLEX start does not create a duplicate workflow run', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/api/v2/activity-room/runs',
      payload: { goal: 'Build the Theme Builder', principalId: 'console-user' },
    });
    expect(first.statusCode).toBe(201);
    const firstBody = first.json() as { executionId: string; workflowRunId?: string };

    const second = await app.inject({
      method: 'POST',
      url: '/api/v2/activity-room/runs',
      payload: { goal: 'Build the Theme Builder', principalId: 'console-user' },
    });
    expect(second.statusCode).toBe(201);
    const secondBody = second.json() as { executionId: string; workflowRunId?: string };

    expect(secondBody.executionId).toBe(firstBody.executionId);
    expect(secondBody.workflowRunId).toBe(firstBody.workflowRunId);

    const snapshot = await app.inject({ method: 'GET', url: '/api/v2/activity-room/snapshot' });
    const snapshotBody = snapshot.json() as { workflowRuns: readonly { id: string }[] };
    const matching = snapshotBody.workflowRuns.filter((run) => run.id === firstBody.workflowRunId);
    expect(matching.length).toBe(1);
  });
});