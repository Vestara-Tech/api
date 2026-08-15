import { randomId } from '../core/identifiers.js';
import type { DiagnosticRun, DiagnosticRunStatus, DiagnosticRunContext, DiagnosticScope, DiagnosticCheckResult, DiagnosticFinding } from './contracts.js';
import { DiagnosticRegistry } from './registry.js';

/**
 * DIAG-004/005/006 — Diagnostic run executor. Lifecycle: created ->
 * discovering -> running -> analyzing -> completed | partial | failed.
 * Findings carry severity, likely causes and (optionally) remediation
 * proposals — Diagnostics observes and investigates, it never repairs.
 */
export class DiagnosticExecutor {
  private readonly registry: DiagnosticRegistry;
  private readonly runs = new Map<string, DiagnosticRun>();
  private readonly env: Readonly<Record<string, unknown>>;

  constructor(registry: DiagnosticRegistry, env: Readonly<Record<string, unknown>> = {}) {
    this.registry = registry;
    this.env = env;
  }

  listRuns(): readonly DiagnosticRun[] {
    return [...this.runs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  getRun(id: string): DiagnosticRun {
    const run = this.runs.get(id);
    if (!run) throw new Error(`Diagnostic run "${id}" not found`);
    return run;
  }

  async run(options: { scope: DiagnosticScope; target?: string; moduleId?: string }): Promise<DiagnosticRun> {
    const runId = randomId('diag');
    const run: DiagnosticRun = {
      id: runId,
      scope: options.scope,
      ...(options.target !== undefined ? { target: options.target } : {}),
      status: 'created',
      startedAt: new Date().toISOString(),
      checks: [],
      findings: [],
      counts: { healthy: 0, degraded: 0, failed: 0 },
    };
    this.runs.set(runId, run);
    this.update(runId, { status: 'discovering' });

    const context: DiagnosticRunContext = { runId, scope: options.scope, ...(options.target !== undefined ? { target: options.target } : {}), env: this.env };
    const contributions = options.moduleId
      ? this.registry.list().filter((c) => c.id === options.moduleId || c.moduleId === options.moduleId)
      : this.registry.list();

    this.update(runId, { status: 'running' });
    const results: DiagnosticCheckResult[] = [];
    for (const contribution of contributions) {
      try {
        results.push(...(await contribution.run(context)));
      } catch (err) {
        results.push({
          checkId: `${contribution.moduleId}.contribution`,
          status: 'unknown',
          severity: 'warning',
          message: `${contribution.moduleId} diagnostics failed: ${(err as Error).message}`,
        });
      }
    }

    this.update(runId, { status: 'analyzing' });
    const findings = results.filter((r) => r.status === 'fail' || r.status === 'degraded').map(toFinding(runId));
    const counts = {
      healthy: results.filter((r) => r.status === 'pass').length,
      degraded: results.filter((r) => r.status === 'degraded').length,
      failed: results.filter((r) => r.status === 'fail').length,
    };

    const completed: Partial<DiagnosticRun> = {
      checks: results,
      findings,
      counts,
      status: counts.failed > 0 ? 'partial' : 'completed',
      completedAt: new Date().toISOString(),
    };
    this.update(runId, completed);
    return this.getRun(runId);
  }

  private update(runId: string, patch: Partial<DiagnosticRun>): void {
    const current = this.runs.get(runId)!;
    this.runs.set(runId, { ...current, ...patch });
  }
}

function toFinding(runId: string): (result: DiagnosticCheckResult) => DiagnosticFinding {
  return (result) => ({
    id: `find_${result.checkId}`,
    runId,
    checkId: result.checkId,
    severity: result.severity,
    status: result.status,
    message: result.message,
    ...(result.detail !== undefined ? { detail: result.detail } : {}),
    at: new Date().toISOString(),
  });
}
