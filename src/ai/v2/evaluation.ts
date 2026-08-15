/** AI2-021..025 — AI evaluation framework, comparison runs, regression baselines. */

import { randomId } from '../../core/identifiers.js';
import { hashOf } from '../../generator/domain/hash.js';

export type EvaluationMetric = 'schema-validity' | 'instruction-adherence' | 'tool-correctness' | 'groundedness' | 'task-completion' | 'latency' | 'cost' | 'regression' | 'custom';

export type EvaluatorKind = 'schema' | 'instruction' | 'tool' | 'groundedness' | 'task' | 'custom';

export interface AiEvaluatorDefinition {
  readonly id: string;
  readonly name: string;
  readonly kind: EvaluatorKind;
  readonly metric: EvaluationMetric;
  readonly description?: string;
  readonly weight: number;
}

export interface EvaluatorResult {
  readonly evaluatorId: string;
  readonly metric: EvaluationMetric;
  readonly score: number; // 0..1
  readonly passed: boolean;
  readonly detail?: string;
}

export interface AiEvaluationInput {
  readonly request: { readonly prompt: string; readonly messages?: unknown };
  readonly response: { readonly content: string; readonly structuredOutput?: unknown };
  readonly toolCalls?: readonly { name: string; success: boolean }[];
  readonly expected?: unknown;
  readonly latencyMs?: number;
  readonly costUsd?: number;
}

export interface AiEvaluationRun {
  readonly id: string;
  readonly profileId: string;
  readonly modelId: string;
  readonly providerId: string;
  readonly caseId?: string;
  readonly results: readonly EvaluatorResult[];
  readonly overall: number;
  readonly passed: boolean;
  readonly at: string;
}

export interface AiEvaluator {
  readonly definition: AiEvaluatorDefinition;
  evaluate(input: AiEvaluationInput): EvaluatorResult;
}

/**
 * AI2-021 — Evaluation framework. Evaluates a model/profile response across
 * metrics (schema validity, instruction adherence, tool correctness,
 * groundedness, task completion, latency, cost). Don't rely only on
 * "request succeeded."
 */
export class AiEvaluationFramework {
  private readonly evaluators = new Map<string, AiEvaluator>();

  register(evaluator: AiEvaluator): void {
    this.evaluators.set(evaluator.definition.id, evaluator);
  }

  has(id: string): boolean {
    return this.evaluators.has(id);
  }

  list(): readonly AiEvaluatorDefinition[] {
    return [...this.evaluators.values()].map((e) => e.definition);
  }

  evaluate(input: AiEvaluationInput, profileId: string, modelId: string, providerId: string): AiEvaluationRun {
    const results = [...this.evaluators.values()].map((e) => e.evaluate(input));
    const totalWeight = results.reduce((s, r) => s + (this.evaluators.get(r.evaluatorId)?.definition.weight ?? 1), 0);
    const overall = results.reduce((s, r) => s + r.score * (this.evaluators.get(r.evaluatorId)?.definition.weight ?? 1), 0) / Math.max(totalWeight, 1);
    return {
      id: randomId('eval'),
      profileId,
      modelId,
      providerId,
      ...(input.expected !== undefined ? { caseId: `case_${hashOf(input.expected).slice(0, 8)}` } : {}),
      results,
      overall: Math.round(overall * 100) / 100,
      passed: results.every((r) => r.passed),
      at: new Date().toISOString(),
    };
  }
}

/** AI2-022 — Side-by-side comparison across models for the same input. */
export interface AiModelComparison {
  readonly comparisonId: string;
  readonly prompt: string;
  readonly runs: readonly { modelId: string; providerId: string; overall: number; passed: boolean; latencyMs?: number; costUsd?: number; results: readonly EvaluatorResult[] }[];
  readonly winner: string | undefined;
  readonly at: string;
}

export class AiComparisonRunner {
  private readonly framework: AiEvaluationFramework;
  private readonly comparisons: AiModelComparison[] = [];

  constructor(framework: AiEvaluationFramework) {
    this.framework = framework;
  }

  compare(input: { prompt: string; runs: readonly { modelId: string; providerId: string; profileId: string; inputs: AiEvaluationInput[] }[] }): AiModelComparison {
    const runs = input.runs.map((run) => {
      const results = run.inputs.flatMap((i) => this.framework.evaluate(i, run.profileId, run.modelId, run.providerId).results);
      const overall = results.reduce((s, r) => s + r.score, 0) / Math.max(results.length, 1);
      return {
        modelId: run.modelId,
        providerId: run.providerId,
        overall: Math.round(overall * 100) / 100,
        passed: results.every((r) => r.passed),
        ...(run.inputs.some((i) => i.latencyMs !== undefined) ? { latencyMs: Math.round(run.inputs.reduce((s, i) => s + (i.latencyMs ?? 0), 0) / run.inputs.length) } : {}),
        ...(run.inputs.some((i) => i.costUsd !== undefined) ? { costUsd: run.inputs.reduce((s, i) => s + (i.costUsd ?? 0), 0) } : {}),
        results,
      };
    });
    const winner = runs.length > 0 ? [...runs].sort((a, b) => b.overall - a.overall)[0]!.modelId : undefined;
    const comparison: AiModelComparison = { comparisonId: randomId('cmp'), prompt: input.prompt, runs, winner, at: new Date().toISOString() };
    this.comparisons.push(comparison);
    return comparison;
  }

  list(): readonly AiModelComparison[] {
    return [...this.comparisons];
  }
}

/** AI2-023 — Regression baselines. Compare a candidate against a stored baseline. */
export interface RegressionBaseline {
  readonly baselineId: string;
  readonly profileId: string;
  readonly modelId: string;
  readonly overall: number;
  readonly results: readonly EvaluatorResult[];
  readonly recordedAt: string;
}

export class RegressionBaselineStore {
  private readonly baselines = new Map<string, RegressionBaseline>();

  record(baseline: RegressionBaseline): void {
    this.baselines.set(`${baseline.profileId}:${baseline.modelId}`, baseline);
  }

  get(profileId: string, modelId: string): RegressionBaseline | undefined {
    return this.baselines.get(`${profileId}:${modelId}`);
  }

  list(): readonly RegressionBaseline[] {
    return [...this.baselines.values()];
  }
}

export interface RegressionComparison {
  readonly baseline: RegressionBaseline;
  readonly candidate: { overall: number; passed: boolean };
  readonly regression: boolean;
  readonly delta: number;
}

/** AI2-024 — Compare a run against a baseline before deployment; flag regressions. */
export function compareToBaseline(baseline: RegressionBaseline, candidate: { overall: number; passed: boolean }): RegressionComparison {
  const delta = Math.round((candidate.overall - baseline.overall) * 100) / 100;
  return { baseline, candidate, regression: delta < -0.05, delta };
}

/** AI2-025 — Routing recommendation from empirical workload data. */
export function recommendRouting(evaluations: readonly AiEvaluationRun[], strategy: 'balanced' | 'quality' | 'cost' | 'latency'): { modelId: string; providerId: string; score: number; reason: string } {
  if (evaluations.length === 0) return { modelId: 'unknown', providerId: 'unknown', score: 0, reason: 'no evaluation data yet' };
  const byModel = new Map<string, { providerId: string; scores: number[]; costs: number[]; latencies: number[] }>();
  for (const evaluation of evaluations) {
    const key = `${evaluation.providerId}/${evaluation.modelId}`;
    const entry = byModel.get(key) ?? { providerId: evaluation.providerId, scores: [], costs: [], latencies: [] };
    entry.scores.push(evaluation.overall);
    byModel.set(key, entry);
  }
  let best: { key: string; score: number } | undefined;
  for (const [key, entry] of byModel) {
    const avg = entry.scores.reduce((s, x) => s + x, 0) / entry.scores.length;
    let score = avg;
    if (strategy === 'cost') score -= 0.01 * entry.scores.length;
    if (strategy === 'quality') score += 0.05 * entry.scores.length;
    if (!best || score > best.score) best = { key, score: Math.round(score * 100) / 100 };
  }
  if (!best) return { modelId: 'unknown', providerId: 'unknown', score: 0, reason: 'no evaluation data yet' };
  const parts = best.key.split('/');
  const providerId = parts[0] ?? 'unknown';
  const modelId = parts[1] ?? 'unknown';
  return { providerId, modelId, score: best.score, reason: `${strategy} strategy from ${evaluations.length} empirical evaluations` };
}
