import { describe, expect, it } from 'vitest';
import {
  AiEvaluationFramework,
  AiComparisonRunner,
  RegressionBaselineStore,
  compareToBaseline,
  recommendRouting,
  defaultEvaluators,
  type AiEvaluationRun,
} from '../../src/ai/v2/index.js';

function makeFramework() {
  const framework = new AiEvaluationFramework();
  for (const evaluator of defaultEvaluators()) framework.register(evaluator);
  return framework;
}

describe('AI2-021 evaluation framework', () => {
  it('registers built-in evaluators', () => {
    const framework = makeFramework();
    const ids = framework.list().map((e) => e.id);
    expect(ids).toContain('eval.schema');
    expect(ids).toContain('eval.instruction');
    expect(ids).toContain('eval.tool');
    expect(framework.has('eval.schema')).toBe(true);
  });

  it('evaluates a good response as passed', () => {
    const framework = makeFramework();
    const run = framework.evaluate(
      {
        request: { prompt: 'return JSON' },
        response: { content: 'ok', structuredOutput: {} },
        toolCalls: [{ name: 'file.read', success: true }],
        latencyMs: 200,
        costUsd: 0.01,
        expected: { schema: {} },
      },
      'vestara.coding',
      'gpt-4o-mini',
      'openai',
    );
    expect(run.passed).toBe(true);
    expect(run.overall).toBeGreaterThan(0.9);
    expect(run.results.some((r) => r.metric === 'schema-validity' && r.passed)).toBe(true);
  });

  it('fails when tools fail', () => {
    const framework = makeFramework();
    const run = framework.evaluate(
      {
        request: { prompt: 'use tool' },
        response: { content: 'done' },
        toolCalls: [{ name: 'file.write', success: false }],
      },
      'vestara.coding',
      'gpt-4o-mini',
      'openai',
    );
    expect(run.passed).toBe(false);
    expect(run.results.find((r) => r.metric === 'tool-correctness')!.score).toBe(0);
  });
});

describe('AI2-022 comparison runs', () => {
  it('compares models side by side and picks a winner', () => {
    const framework = makeFramework();
    const runner = new AiComparisonRunner(framework);
    const comparison = runner.compare({
      prompt: 'summarize',
      runs: [
        { modelId: 'model-a', providerId: 'openai', profileId: 'vestara.fast', inputs: [{ request: { prompt: 'x' }, response: { content: 'good' }, latencyMs: 100 }] },
        { modelId: 'model-b', providerId: 'openai', profileId: 'vestara.fast', inputs: [{ request: { prompt: 'x' }, response: { content: 'bad' }, toolCalls: [{ name: 't', success: false }] }] },
      ],
    });
    expect(comparison.runs).toHaveLength(2);
    expect(comparison.winner).toBe('model-a');
    expect(runner.list()).toHaveLength(1);
  });
});

describe('AI2-023/024 regression baselines', () => {
  it('records baselines and detects regressions', () => {
    const store = new RegressionBaselineStore();
    const baseline = { baselineId: 'b1', profileId: 'vestara.coding', modelId: 'm', overall: 0.95, results: [], recordedAt: new Date().toISOString() };
    store.record(baseline);
    expect(store.get('vestara.coding', 'm')!.overall).toBe(0.95);

    const ok = compareToBaseline(baseline, { overall: 0.96, passed: true });
    expect(ok.regression).toBe(false);

    const regression = compareToBaseline(baseline, { overall: 0.80, passed: false });
    expect(regression.regression).toBe(true);
    expect(regression.delta).toBe(-0.15);
  });
});

describe('AI2-025 routing recommendations', () => {
  it('recommends from empirical evaluation data', () => {
    const evaluations: readonly AiEvaluationRun[] = [
      { id: 'e1', profileId: 'p', modelId: 'a', providerId: 'openai', overall: 0.9, passed: true, results: [], at: '2026-01-01T00:00:00Z' },
      { id: 'e2', profileId: 'p', modelId: 'a', providerId: 'openai', overall: 0.95, passed: true, results: [], at: '2026-01-01T00:00:01Z' },
      { id: 'e3', profileId: 'p', modelId: 'b', providerId: 'ollama', overall: 0.7, passed: true, results: [], at: '2026-01-01T00:00:02Z' },
    ];
    const recommendation = recommendRouting(evaluations, 'quality');
    expect(recommendation.modelId).toBe('a');
    expect(recommendation.providerId).toBe('openai');
    expect(recommendation.reason).toContain('empirical');
  });

  it('returns unknown when no data', () => {
    expect(recommendRouting([], 'balanced').modelId).toBe('unknown');
  });
});
