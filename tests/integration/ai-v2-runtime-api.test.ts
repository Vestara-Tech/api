import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createApplication } from '../../src/bootstrap/application.js';
import { loadConfig } from '../../src/config/schema.js';
import type { AiSessionManager } from '../../src/ai/v2/session.js';
import type { BudgetEngine } from '../../src/ai/v2/budget.js';
import type { UsageAggregator } from '../../src/ai/v2/usage.js';
import type { AiTracer } from '../../src/ai/v2/trace.js';

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

describe('AI platform v2 runtime API (AI2-011..019)', () => {
  it('creates sessions and conversations', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v2/ai/v2/sessions',
      payload: { consumerId: 'agent-1', profileId: 'vestara.fast', title: 'Dev' },
    });
    expect(create.statusCode).toBe(201);
    const session = create.json();
    expect(session.requestCount).toBe(0);

    const conversation = await app.inject({ method: 'POST', url: `/api/v2/ai/v2/sessions/${session.id}/conversations` });
    expect(conversation.statusCode).toBe(201);

    const message = await app.inject({
      method: 'POST',
      url: `/api/v2/ai/v2/conversations/${conversation.json().id}/messages`,
      payload: { role: 'user', content: 'hello' },
    });
    expect(message.json().messages).toHaveLength(1);

    const sessions = await app.inject({ method: 'GET', url: '/api/v2/ai/v2/sessions' });
    expect(sessions.json().some((s: { id: string }) => s.id === session.id)).toBe(true);
  });

  it('sets budget limits', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/ai/v2/budgets',
      payload: { scope: 'agent', scopeId: 'dev', maxRequests: 100, onThreshold: 'warn', thresholdRatio: 0.5 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().set).toBe(true);
  });

  it('aggregates usage and lists traces', async () => {
    const usage = app.application.container.resolve<UsageAggregator>('ai.v2.usage');
    usage.record({ requestId: 'r1', consumerId: 'agent-1', providerId: 'openai', modelId: 'gpt-4o-mini', latencyMs: 150, startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), fallbackCount: 0, inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.01 });

    const agg = await app.inject({ method: 'GET', url: '/api/v2/ai/v2/usage' });
    expect(agg.json().requests).toBe(1);

    const grouped = await app.inject({ method: 'GET', url: '/api/v2/ai/v2/usage/grouped?by=provider' });
    expect(grouped.json().groups[0]!.key).toBe('openai');

    const tracer = app.application.container.resolve<AiTracer>('ai.v2.tracer');
    tracer.begin('req_x', 'openai', 'gpt-4o-mini');
    const traces = await app.inject({ method: 'GET', url: '/api/v2/ai/v2/traces' });
    expect(traces.json().length).toBeGreaterThanOrEqual(1);
  });
});
