/**
 * ARX-CP1 ARX-004 — Complexity classification.
 *
 * Determines whether a goal requires SIMPLE, STANDARD, or COMPLEX routing.
 * This is a pure function — no side effects, no external calls.
 */

import type { ActivityExecutionComplexity } from './contracts.js';

/** Classification result. */
export interface ComplexityClassification {
  readonly level: ActivityExecutionComplexity;
  readonly reason: string;
  readonly estimatedAgents: readonly string[];
}

/** Heuristic indicators for complexity levels. */
const COMPLEX_INDICATORS = [
  'theme builder',
  'full application',
  'complete redesign',
  'migration',
  'refactor entire',
  'build the',
  'entire system',
  'all pages',
  'end to end',
  'full stack',
];

const STANDARD_INDICATORS = [
  'add a',
  'create a',
  'build a',
  'implement',
  'component',
  'page',
  'feature',
  'api endpoint',
  'cli command',
  'integration',
  'module',
  'service',
  'hook',
  'layout',
];

const SIMPLE_INDICATORS = [
  'hello',
  'print',
  'console.log',
  'echo',
  'show',
  'list',
  'status',
  'info',
  'version',
];

/**
 * Classify a goal into complexity level.
 *
 * SIMPLE: Single Developer execution, bounded scope.
 * STANDARD: Planner → Developer → Verifier pipeline.
 * COMPLEX: Full Planner → Milestones → Tasks → Developer iterations → Reviewer → Verifier.
 */
export function classifyComplexity(goal: string): ComplexityClassification {
  const lower = goal.toLowerCase();

  // Check for explicit complexity markers first.
  for (const indicator of COMPLEX_INDICATORS) {
    if (lower.includes(indicator)) {
      return {
        level: 'complex',
        reason: `Contains complex indicator: "${indicator}"`,
        estimatedAgents: ['planner', 'developer', 'reviewer', 'verifier'],
      };
    }
  }

  // Standard before simple — "status" is simple but "add a CLI command" is standard.
  for (const indicator of STANDARD_INDICATORS) {
    if (lower.includes(indicator)) {
      // Check if a simple indicator also matches — if the primary noun is simple,
      // still classify as simple (e.g. "show status" = simple, "add a CLI command" = standard).
      const hasSimpleNoun = SIMPLE_INDICATORS.some((s) => lower.includes(s));
      const hasStandardVerb = ['add a', 'create a', 'build a', 'implement'].some((v) => lower.includes(v));
      if (hasSimpleNoun && !hasStandardVerb) {
        return {
          level: 'simple',
          reason: `Simple noun with standard indicator`,
          estimatedAgents: ['developer'],
        };
      }
      return {
        level: 'standard',
        reason: `Contains standard indicator: "${indicator}"`,
        estimatedAgents: ['planner', 'developer', 'verifier'],
      };
    }
  }

  for (const indicator of SIMPLE_INDICATORS) {
    if (lower.includes(indicator)) {
      return {
        level: 'simple',
        reason: `Contains simple indicator: "${indicator}"`,
        estimatedAgents: ['developer'],
      };
    }
  }

  // Default to standard for ambiguous goals.
  return {
    level: 'standard',
    reason: 'No clear complexity indicators — defaulting to standard',
    estimatedAgents: ['planner', 'developer', 'verifier'],
  };
}
