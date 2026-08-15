# ADR-0046 — AI Module v2: Evaluation, Comparison, Baselines (AI2-021..025)

- Status: accepted
- Date: 2026-08-15
- Applies to: AI2-021 — AI2-025

## Context

AI2-011..020 delivered the governed execution path with usage/trace/evidence.
The recommendation completes the AI platform with the quality layer: "Don't
rely only on 'request succeeded.'" Evaluations, side-by-side comparisons,
regression baselines and empirical routing recommendations.

## Decision

> **AI model/profile quality is measured, compared and regression-checked
> before deployment — not assumed from "request succeeded." Routing
> recommendations come from empirical Vestara workload data, not generic
> benchmark scores.**

### 1. Evaluation framework (AI2-021)

`AiEvaluationFramework` evaluates a response across metrics: schema-validity,
instruction-adherence, tool-correctness, groundedness, task-completion,
latency, cost. Weighted overall score + passed. Built-in evaluators for
schema/instruction/tool/latency/cost.

### 2. Comparison runs (AI2-022)

`AiComparisonRunner` runs the same prompt against multiple models
side-by-side and reports per-model overall/passed/latency/cost with a winner.

### 3. Regression baselines (AI2-023/024)

`RegressionBaselineStore` records baselines per profile/model;
`compareToBaseline` flags regression when the candidate drops >5% below the
baseline. Test Module can compare a profile/model revision against a baseline
before deployment.

### 4. Routing recommendations (AI2-025)

`recommendRouting` recommends a model from empirical evaluation data under a
strategy (balanced/quality/cost/latency), feeding profile routing decisions
with real workload data.

## Consequences

- AI2-021..025 complete: evaluation framework, built-in evaluators,
  comparison runs, regression baselines, empirical routing recommendations.
- New control API: `/api/v2/ai/v2/evaluators`, `/evaluate`, `/compare`,
  `/evaluations/:profileId/:modelId/baseline`, `/evaluations/baselines`.
  OpenAPI regenerated and in sync.
- 10 new tests (7 unit + 3 integration). 752 total.
- The AI Module is now a complete governed, observable, routable, evaluable
  intelligence platform. AIUI surfaces (Overview, Providers, Models,
  Playground, Compare, Usage) and Builder/Workflow/Generator integration
  follow.
