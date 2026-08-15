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

describe('AI platform v2 evaluation API (AI2-021..025)', () => {
  it('lists registered evaluators', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/ai/v2/evaluators' });
    expect(res.statusCode).toBe(200);
    const evaluators = res.json();
    expect(evaluators.some((e: { id: string }) => e.id === 'eval.schema')).toBe(true);
    expect(evaluators.some((e: { id: string }) => e.id === 'eval.tool')).toBe(true);
  });

  it('evaluates a model response', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/ai/v2/evaluate',
      payload: {
        profileId: 'vestara.coding',
        modelId: 'gpt-4o-mini',
        providerId: 'openai',
        request: { prompt: 'return JSON' },
        response: { content: 'ok' },
        toolCalls: [{ name: 'file.read', success: true }],
        latencyMs: 200,
        costUsd: 0.01,
      },
    });
    expect(res.statusCode).toBe(200);
    const run = res.json();
    expect(run.overall).toBeGreaterThan(0);
    expect(run.results.length).toBeGreaterThan(0);
  });

  it('compares models and records a baseline', async () => {
    const compare = await app.inject({
      method: 'POST',
      url: '/api/v2/ai/v2/compare',
      payload: {
        prompt: 'summarize',
        runs: [
          { modelId: 'a', providerId: 'openai', profileId: 'vestara.fast', inputs: [{ request: { prompt: 'x' }, response: { content: 'good' }, latencyMs: 100 }] },
          { modelId: 'b', providerId: 'ollama', profileId: 'vestara.fast', inputs: [{ request: { prompt: 'x' }, response: { content: 'bad' } }] },
        ],
      },
    });
    expect(compare.statusCode).toBe(200);
    expect(compare.json().winner).toBe('a');

    const baseline = await app.inject({
      method: 'POST',
      url: '/api/v2/ai/v2/evaluations/vestara.coding/gpt-4o-mini/baseline',
      payload: { overall: 0.9, results: [{ evaluatorId: 'eval.schema', metric: 'schema-validity', score: 1, passed: true }] },
    });
    expect(baseline.statusCode).toBe(200);
    expect(baseline.json().overall).toBe(0.9);

    const baselines = await app.inject({ method: 'GET', url: '/api/v2/ai/v2/evaluations/baselines' });
    expect(baselines.json().some((b: { modelId: string }) => b.modelId === 'gpt-4o-mini')).toBe(true);
  });
});
