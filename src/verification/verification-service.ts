import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type VerificationScope = 'static' | 'affected' | 'module' | 'platform';

export interface VerificationGraphIssue {
  readonly severity: 'error' | 'warning' | 'info';
  readonly code: string;
  readonly message: string;
  readonly module?: string;
  readonly dependency?: string;
  readonly alias?: string;
  readonly path?: string;
}

export interface VerificationReportSnapshot {
  readonly version: 1;
  readonly level: string;
  readonly scope: string;
  readonly changedFiles: readonly string[];
  readonly affectedModules: readonly string[];
  readonly selectedTests: readonly string[];
  readonly executedTests: readonly string[];
  readonly reusedTests: readonly string[];
  readonly skippedTests: readonly string[];
  readonly passed: number;
  readonly failed: number;
  readonly cached: number;
  readonly escalated: boolean;
  readonly escalationReasons: readonly string[];
  readonly durationMs: number;
  readonly graphValid: boolean;
  readonly graphIssues: readonly VerificationGraphIssue[];
  readonly result: 'pass' | 'fail' | 'indeterminate';
  readonly verified: boolean;
  readonly evidence: string | null;
  readonly reportPath?: string;
  readonly fingerprint?: string | null;
}

export interface RunVerificationOptions {
  readonly scope?: VerificationScope;
  readonly moduleName?: string;
  readonly noCache?: boolean;
  readonly repoRoot?: string;
}

export interface VerificationRuntimeOverrides {
  readonly spawn?: typeof spawnSync;
}

export interface RunVerificationResult {
  readonly ok: boolean;
  readonly exitCode: number;
  readonly output: string;
  readonly report: VerificationReportSnapshot | null;
  readonly reportPath: string;
  readonly fingerprint: string | null;
}

function repoRoot(input: { repoRoot?: string } = {}): string {
  return input.repoRoot ?? process.cwd();
}

function latestReportPath(root: string): string {
  return join(root, '.vestara', 'evidence', 'verification', 'latest.json');
}

function parseReport(raw: string): VerificationReportSnapshot | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    return JSON.parse(text) as VerificationReportSnapshot;
  } catch {
    return null;
  }
}

export function readLatestVerificationReport(input: { repoRoot?: string } = {}): VerificationReportSnapshot | null {
  const root = repoRoot(input);
  const path = latestReportPath(root);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as VerificationReportSnapshot;
  } catch {
    return null;
  }
}

export function runVerificationCommand(input: RunVerificationOptions = {}, overrides: VerificationRuntimeOverrides = {}): RunVerificationResult {
  const root = repoRoot(input);
  const spawn = overrides.spawn ?? spawnSync;
  const args = ['verify'];
  if (input.moduleName !== undefined) {
    args.push('module', input.moduleName);
  } else if (input.scope !== undefined) {
    args.push(input.scope);
  }
  if (input.noCache === true) args.push('--no-cache');
  args.push('--json');

  const result = spawn('pnpm', args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 1_800_000,
    maxBuffer: 50 * 1024 * 1024,
  });

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  const parsed = parseReport(String(result.stdout ?? ''));
  const latest = parsed ?? readLatestVerificationReport({ repoRoot: root });

  return {
    ok: result.status === 0,
    exitCode: result.status ?? 1,
    output,
    report: latest,
    reportPath: latest?.reportPath ?? latestReportPath(root),
    fingerprint: latest?.fingerprint ?? null,
  };
}
