import type { ServiceReadinessState } from './readiness.js';

export interface ProgressSnapshot {
  readonly overallPercent: number;
  readonly readyCount: number;
  readonly totalCount: number;
  readonly weightedPercent: number;
}

const READINESS_PERCENT: Record<ServiceReadinessState['readiness'], number> = {
  'not-started': 0,
  starting: 45,
  ready: 100,
  degraded: 75,
  failed: 0,
};

/**
 * DESK-005 — Progress aggregation. Overall startup progress is a weighted
 * aggregate of service readiness, so the UI shows one coherent percentage.
 */
export function computeProgress(states: readonly ServiceReadinessState[]): ProgressSnapshot {
  if (states.length === 0) {
    return { overallPercent: 0, readyCount: 0, totalCount: 0, weightedPercent: 0 };
  }
  const totalWeight = states.reduce((sum, s) => sum + s.weight, 0);
  const weighted = states.reduce((sum, s) => sum + (READINESS_PERCENT[s.readiness] * s.weight) / 100, 0);
  const weightedPercent = totalWeight > 0 ? Math.round((weighted / totalWeight) * 100) : 0;
  const readyCount = states.filter((s) => s.readiness === 'ready').length;
  return { overallPercent: weightedPercent, readyCount, totalCount: states.length, weightedPercent };
}
