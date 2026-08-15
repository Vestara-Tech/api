/** DIAG-001/002/005/006 — Diagnostics domain contracts. */

export type DiagnosticCategory = 'system' | 'api' | 'module' | 'service' | 'runtime' | 'network' | 'storage' | 'database' | 'browser' | 'integration' | 'security' | 'os';

export type DiagnosticCheckStatus = 'pass' | 'fail' | 'degraded' | 'unknown' | 'unsupported' | 'skipped';

export type DiagnosticSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface DiagnosticCheckDefinition {
  readonly id: string;
  readonly name: string;
  readonly category: DiagnosticCategory;
  readonly risk: 'low' | 'medium' | 'high';
  readonly timeoutMs: number;
  readonly capabilities: readonly string[];
}

export interface DiagnosticContribution {
  readonly id: string;
  readonly moduleId: string;
  readonly version: string;
  readonly checks: readonly DiagnosticCheckDefinition[];
  readonly run: (context: DiagnosticRunContext) => Promise<readonly DiagnosticCheckResult[]>;
}

export interface DiagnosticRunContext {
  readonly runId: string;
  readonly scope: DiagnosticScope;
  readonly target?: string;
  readonly env: Readonly<Record<string, unknown>>;
}

export type DiagnosticScope = 'system' | 'module' | 'service' | 'runtime' | 'workspace' | 'application' | 'workflow' | 'agent' | 'integration' | 'network' | 'storage' | 'database';

export interface DiagnosticCheckResult {
  readonly checkId: string;
  readonly status: DiagnosticCheckStatus;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly detail?: string;
  readonly durationMs?: number;
  readonly evidence?: Readonly<Record<string, unknown>>;
}

export interface DiagnosticFinding {
  readonly id: string;
  readonly runId: string;
  readonly checkId: string;
  readonly severity: DiagnosticSeverity;
  readonly status: DiagnosticCheckStatus;
  readonly message: string;
  readonly detail?: string;
  readonly relatedLogs?: readonly string[];
  readonly likelyCauses?: readonly string[];
  readonly remediation?: string;
  readonly remediationRisk?: 'low' | 'medium' | 'high';
  readonly at: string;
}

export type DiagnosticRunStatus = 'created' | 'discovering' | 'running' | 'analyzing' | 'completed' | 'partial' | 'failed' | 'cancelled';

export interface DiagnosticRun {
  readonly id: string;
  readonly scope: DiagnosticScope;
  readonly target?: string;
  readonly status: DiagnosticRunStatus;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly checks: readonly DiagnosticCheckResult[];
  readonly findings: readonly DiagnosticFinding[];
  readonly counts: { healthy: number; degraded: number; failed: number };
}
