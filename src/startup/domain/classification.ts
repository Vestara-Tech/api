import type { StartupServiceDefinition, ServiceReadinessState } from './readiness.js';
import type { StartupDependencyGraph } from './dependency-graph.js';

export type StartupClassification = 'healthy' | 'degraded' | 'failed';

export interface ClassificationIssue {
  readonly serviceId: string;
  readonly kind: 'failed-required' | 'failed-optional' | 'degraded' | 'blocked';
  readonly message: string;
}

export interface StartupClassificationResult {
  readonly classification: StartupClassification;
  readonly issues: readonly ClassificationIssue[];
}

/**
 * DESK-006 — Failure/degraded classification.
 *
 * Required service failure → failed. Optional service failure or degraded
 * services → degraded. Blocked services (unresolved required dependency) are
 * reported separately.
 */
export function classifyStartup(
  definitions: readonly StartupServiceDefinition[],
  states: readonly ServiceReadinessState[],
  graph: StartupDependencyGraph,
): StartupClassificationResult {
  const byId = new Map(states.map((s) => [s.serviceId, s]));
  const issues: ClassificationIssue[] = [];

  for (const def of definitions) {
    const state = byId.get(def.id);
    if (!state) continue;
    if (state.readiness === 'failed') {
      issues.push({
        serviceId: def.id,
        kind: def.required ? 'failed-required' : 'failed-optional',
        message: `${def.name} ${def.required ? 'failed (required)' : 'failed (optional)'}${state.detail ? `: ${state.detail}` : ''}`,
      });
    } else if (state.readiness === 'degraded') {
      issues.push({ serviceId: def.id, kind: 'degraded', message: `${def.name} is degraded` });
    }
  }

  const unresolved = (id: string) => !(byId.get(id)?.readiness === 'ready');
  for (const blockedId of graph.blocked(unresolved)) {
    issues.push({ serviceId: blockedId, kind: 'blocked', message: `${blockedId} is blocked by an unresolved dependency` });
  }

  const hasFailedRequired = issues.some((i) => i.kind === 'failed-required');
  const classification: StartupClassification = hasFailedRequired ? 'failed' : issues.length > 0 ? 'degraded' : 'healthy';
  return { classification, issues };
}
