import type { AiEvaluator, AiEvaluationInput } from './evaluation.js';

/** AI2-021 — Built-in evaluators. */

export function schemaEvaluator(): AiEvaluator {
  return {
    definition: { id: 'eval.schema', name: 'Schema Validity', kind: 'schema', metric: 'schema-validity', weight: 1 },
    evaluate: (input: AiEvaluationInput) => {
      const expected = input.expected as { schema?: unknown } | undefined;
      const passed = expected?.schema === undefined || input.response.structuredOutput !== undefined;
      return { evaluatorId: 'eval.schema', metric: 'schema-validity', score: passed ? 1 : 0, passed };
    },
  };
}

export function instructionEvaluator(): AiEvaluator {
  return {
    definition: { id: 'eval.instruction', name: 'Instruction Adherence', kind: 'instruction', metric: 'instruction-adherence', weight: 1 },
    evaluate: (input: AiEvaluationInput) => {
      const hasContent = input.response.content.trim().length > 0;
      return { evaluatorId: 'eval.instruction', metric: 'instruction-adherence', score: hasContent ? 1 : 0, passed: hasContent };
    },
  };
}

export function toolEvaluator(): AiEvaluator {
  return {
    definition: { id: 'eval.tool', name: 'Tool Correctness', kind: 'tool', metric: 'tool-correctness', weight: 1 },
    evaluate: (input: AiEvaluationInput) => {
      const calls = input.toolCalls ?? [];
      if (calls.length === 0) return { evaluatorId: 'eval.tool', metric: 'tool-correctness', score: 1, passed: true, detail: 'no tools expected' };
      const allPassed = calls.every((c) => c.success);
      const passed = allPassed;
      return { evaluatorId: 'eval.tool', metric: 'tool-correctness', score: passed ? 1 : calls.filter((c) => c.success).length / calls.length, passed, ...(allPassed ? {} : { detail: 'some tool calls failed' }) };
    },
  };
}

export function latencyEvaluator(): AiEvaluator {
  return {
    definition: { id: 'eval.latency', name: 'Latency', kind: 'custom', metric: 'latency', weight: 0.5 },
    evaluate: (input: AiEvaluationInput) => {
      const latency = input.latencyMs ?? 0;
      const score = latency === 0 ? 1 : Math.max(0, 1 - latency / 5000);
      return { evaluatorId: 'eval.latency', metric: 'latency', score: Math.round(score * 100) / 100, passed: score >= 0.5 };
    },
  };
}

export function costEvaluator(): AiEvaluator {
  return {
    definition: { id: 'eval.cost', name: 'Cost', kind: 'custom', metric: 'cost', weight: 0.5 },
    evaluate: (input: AiEvaluationInput) => {
      const cost = input.costUsd ?? 0;
      const score = cost === 0 ? 1 : Math.max(0, 1 - cost / 0.5);
      return { evaluatorId: 'eval.cost', metric: 'cost', score: Math.round(score * 100) / 100, passed: score >= 0.5 };
    },
  };
}

export function defaultEvaluators(): readonly AiEvaluator[] {
  return [schemaEvaluator(), instructionEvaluator(), toolEvaluator(), latencyEvaluator(), costEvaluator()];
}
