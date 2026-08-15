import type { CoverageReport } from '../contracts.js';

/** TEST-018 — Coverage engine. Aggregates per-file line/branch/function/statement coverage. */
export class CoverageEngine {
  build(input: { lines: number; branches: number; functions: number; statements: number; files?: readonly { path: string; lines: number; branches: number; functions: number; statements: number }[]; baseline?: number; thresholds?: number }): CoverageReport {
    const report: CoverageReport = {
      lines: input.lines,
      branches: input.branches,
      functions: input.functions,
      statements: input.statements,
      files: input.files ?? [],
      ...(input.baseline !== undefined ? { baseline: input.baseline } : {}),
      ...(input.thresholds !== undefined ? { thresholds: input.thresholds } : {}),
    };
    const result: CoverageReport = { ...report, ...(input.baseline !== undefined ? { delta: input.lines - input.baseline } : {}) };
    return result;
  }

  meetsThreshold(report: CoverageReport, threshold: number): boolean {
    return report.lines >= threshold;
  }
}
