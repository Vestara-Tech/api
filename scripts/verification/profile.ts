import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import { findTestFiles, REPO_ROOT } from './affected.ts';
import { EVIDENCE_DIR } from './evidence.ts';
import { runVerification, type VerificationExecution } from './verify.ts';

export type ProfileCacheState = 'cold' | 'warm';
export type ProfileScenarioId = 'B1' | 'B2' | 'B3' | 'B4';

export interface ProfileScenario {
  readonly id: ProfileScenarioId;
  readonly label: string;
  readonly description: string;
}

export const FROZEN_PROFILE_SCENARIOS: readonly ProfileScenario[] = [
  {
    id: 'B1',
    label: 'V3 platform',
    description: 'Frozen CP2 SHA baseline: full platform verification.',
  },
  {
    id: 'B2',
    label: 'backend/module change',
    description: 'Fixed representative backend or module change fixture.',
  },
  {
    id: 'B3',
    label: 'application-only change',
    description: 'Fixed representative Admin or Workspace change fixture.',
  },
  {
    id: 'B4',
    label: 'shared UI change',
    description: 'Fixed representative @vestara/ui change fixture.',
  },
];

export interface TurboDryRunTask {
  readonly taskId?: string;
  readonly task: string;
  readonly package: string;
  readonly directory: string;
}

export interface TurboDryRunPlan {
  readonly packages: string[];
  readonly tasks: TurboDryRunTask[];
}

export interface TurboExecutionSummary {
  readonly packagesInScope: string[];
  readonly packagesCount: number;
  readonly tasks: number;
  readonly successfulTasks: number;
  readonly cacheHits: number;
  readonly cacheMisses: number;
  readonly durationMs: number;
  readonly passed: boolean;
}

export interface VerificationProfileV1 {
  readonly schemaVersion: 1;
  readonly provenance: {
    readonly gitSha: string;
    readonly fingerprint: string;
    readonly timestamp: string;
    readonly nodeVersion: string;
    readonly pnpmVersion: string;
  };
  readonly benchmark: {
    readonly scenario: ProfileScenario;
    readonly cacheState: ProfileCacheState;
    readonly resetPolicy: string;
    readonly frozenScenarios: readonly ProfileScenario[];
  };
  readonly verification: {
    readonly reportPath: string;
    readonly fingerprint: string | null;
    readonly level: string;
    readonly result: 'pass' | 'fail' | 'indeterminate';
    readonly graphValid: boolean;
    readonly selectedTests: number;
    readonly executedTests: number;
    readonly cachedTests: number;
  };
  readonly timing: {
    readonly totalMs: number;
    readonly controlPlaneMs: number;
    readonly changeDetectionMs: number;
    readonly graphMs: number;
    readonly impactMs: number;
    readonly fingerprintMs: number;
    readonly evidenceLookupMs: number;
    readonly staticMs: number;
    readonly vitestMs: number;
    readonly turboMs: number;
    readonly profileOverheadMs: number;
  };
  readonly turbo: {
    readonly packagesInScope: number;
    readonly tasks: number;
    readonly successfulTasks: number;
    readonly cacheHits: number;
    readonly cacheMisses: number;
    readonly cacheHitRate: number;
  };
  readonly overlap: {
    readonly fastVerifyTests: number;
    readonly turboAffectedTests: number;
    readonly overlappingTests: number;
    readonly overlapRate: number;
  };
  readonly result: 'pass' | 'fail' | 'indeterminate';
  readonly artifacts: {
    readonly profilePath: string;
    readonly verificationReportPath: string;
  };
}

const HELP = `Usage: pnpm verify:profile [--json] [--cache-state cold|warm]

Capture a CP3A verification profile for the frozen benchmark set.
Defaults to the B1 platform baseline and cold-cache execution.
Artifacts are written under .vestara/evidence/verification/profiles/<sha>/.
Flags: --json           machine-readable profile
       --cache-state    cold|warm (default: cold)`;

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, '-');
}

function readGitSha(): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' });
  const sha = result.stdout.trim();
  return sha.length > 0 ? sha : 'unknown';
}

function readPnpmVersion(): string {
  try {
    const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
      packageManager?: string;
    };
    const match = packageJson.packageManager?.match(/^pnpm@(.+)$/);
    return match?.[1] ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function extractJsonLines(output: string): Record<string, unknown>[] {
  const lines: Record<string, unknown>[] = [];
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith('{')) continue;
    try {
      lines.push(JSON.parse(line) as Record<string, unknown>);
    } catch {
      // skip malformed lines
    }
  }
  return lines;
}

export function parseTurboTextSummary(output: string): Partial<TurboExecutionSummary> {
  const summary: Partial<TurboExecutionSummary> = {};
  for (const line of output.split(/\r?\n/)) {
    const text = line.trim();
    if (!text) continue;

    const packagesMatch = text.match(/^Packages in scope:\s*(.*)$/);
    if (packagesMatch) {
      const packages = packagesMatch[1]?.split(',').map((entry) => entry.trim()).filter(Boolean) ?? [];
      summary.packagesInScope = packages;
      continue;
    }

    const tasksMatch = text.match(/^Tasks:\s+(\d+)\s+successful,\s+(\d+)\s+total$/);
    if (tasksMatch) {
      summary.successfulTasks = Number(tasksMatch[1]);
      summary.tasks = Number(tasksMatch[2]);
      continue;
    }

    const cachedMatch = text.match(/^Cached:\s+(\d+)\s+cached,\s+(\d+)\s+total$/);
    if (cachedMatch) {
      summary.cacheHits = Number(cachedMatch[1]);
      summary.cacheMisses = Number(cachedMatch[2]) - Number(cachedMatch[1]);
    }
  }
  return summary;
}

function runTurboDryRun(cacheState: ProfileCacheState): TurboDryRunPlan {
  const args = ['exec', 'turbo', 'run', 'test', '--dry-run=json', '--output-logs=none'];
  if (cacheState === 'cold') args.push('--no-cache');
  const result = spawnSync('pnpm', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 1_800_000,
    maxBuffer: 50 * 1024 * 1024,
  });
  const stdout = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start < 0 || end < start) {
    return { packages: [], tasks: [] };
  }

  try {
    const parsed = JSON.parse(stdout.slice(start, end + 1)) as {
      packages?: string[];
      tasks?: TurboDryRunTask[];
    };
    return {
      packages: parsed.packages ?? [],
      tasks: parsed.tasks ?? [],
    };
  } catch {
    return { packages: [], tasks: [] };
  }
}

function runTurboExecution(cacheState: ProfileCacheState): TurboExecutionSummary {
  const args = ['exec', 'turbo', 'run', 'test', '--json', '--output-logs=none'];
  if (cacheState === 'cold') args.push('--no-cache');

  const start = performance.now();
  const result = spawnSync('pnpm', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 1_800_000,
    maxBuffer: 50 * 1024 * 1024,
  });
  const durationMs = performance.now() - start;
  const parsedLines = extractJsonLines(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  const text = parsedLines
    .map((line) => (typeof line.text === 'string' ? line.text : ''))
    .filter(Boolean)
    .join('\n');
  const summary = parseTurboTextSummary(text);

  const packagesInScope = summary.packagesInScope ?? [];
  const tasks = summary.tasks ?? 0;
  const successfulTasks = summary.successfulTasks ?? 0;
  const cacheHits = summary.cacheHits ?? 0;
  const cacheMisses = summary.cacheMisses ?? (tasks - cacheHits);

  return {
    packagesInScope,
    packagesCount: packagesInScope.length,
    tasks,
    successfulTasks,
    cacheHits,
    cacheMisses,
    durationMs,
    passed: result.status === 0,
  };
}

export function buildOverlap(fastVerifyTests: readonly string[], turboAffectedTests: readonly string[]) {
  const fast = new Set(fastVerifyTests);
  const turbo = new Set(turboAffectedTests);
  let overlap = 0;
  for (const file of fast) {
    if (turbo.has(file)) overlap += 1;
  }
  return {
    fastVerifyTests: fast.size,
    turboAffectedTests: turbo.size,
    overlappingTests: overlap,
    overlapRate: fast.size > 0 ? overlap / fast.size : 0,
  };
}

export function buildProfilePath(gitSha: string, fingerprint: string | null, cacheState: ProfileCacheState): string {
  const safeFingerprint = sanitizeSegment(fingerprint ?? 'graph-invalid');
  return join(EVIDENCE_DIR, 'profiles', gitSha, `${safeFingerprint}-${cacheState}.json`);
}

export function saveVerificationProfile(profile: VerificationProfileV1): string {
  const path = buildProfilePath(profile.provenance.gitSha, profile.provenance.fingerprint, profile.benchmark.cacheState);
  mkdirSync(join(EVIDENCE_DIR, 'profiles', profile.provenance.gitSha), { recursive: true });
  writeFileSync(path, JSON.stringify(profile, null, 2), 'utf8');
  return path;
}

export function runVerificationProfile(cacheState: ProfileCacheState = 'cold'): VerificationProfileV1 {
  const scenario = FROZEN_PROFILE_SCENARIOS[0]!;
  const profileStart = performance.now();
  const gitSha = readGitSha();
  const verification: VerificationExecution = runVerification({
    scope: 'platform',
    noCache: cacheState === 'cold',
  });
  const dryRun = runTurboDryRun(cacheState);
  const turbo = runTurboExecution(cacheState);
  const totalMs = performance.now() - profileStart;

  const workspaceTestFiles = findTestFiles(REPO_ROOT).filter((file) =>
    dryRun.tasks.some((task) => task.task === 'test' && file.startsWith(`${task.directory}/`)),
  );
  const overlap = buildOverlap(verification.report.selectedTests, workspaceTestFiles);
  const controlPlaneMs =
    verification.timings.changeDetectionMs +
    verification.timings.graphMs +
    verification.timings.impactMs +
    verification.timings.fingerprintMs +
    verification.timings.evidenceLookupMs;
  const profileOverheadMs = Math.max(0, totalMs - verification.timings.totalMs - turbo.durationMs);
  const turboPackageCount = turbo.packagesCount > 0 ? turbo.packagesCount : dryRun.packages.length;
  const turboTaskCount = turbo.tasks > 0 ? turbo.tasks : dryRun.tasks.length;
  const turboSuccessfulTasks = turbo.successfulTasks > 0 ? turbo.successfulTasks : turbo.passed ? turboTaskCount : 0;
  const result: 'pass' | 'fail' | 'indeterminate' =
    verification.report.result === 'pass' && turbo.passed
      ? 'pass'
      : verification.report.result === 'indeterminate'
        ? 'indeterminate'
        : 'fail';
  const artifactPath = buildProfilePath(gitSha, verification.fingerprint, cacheState);

  const profile: VerificationProfileV1 = {
    schemaVersion: 1,
    provenance: {
      gitSha,
      fingerprint: verification.fingerprint ?? 'graph-invalid',
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      pnpmVersion: readPnpmVersion(),
    },
    benchmark: {
      scenario,
      cacheState,
      resetPolicy: 'verification-v1',
      frozenScenarios: FROZEN_PROFILE_SCENARIOS,
    },
    verification: {
      reportPath: verification.reportPath,
      fingerprint: verification.fingerprint,
      level: verification.report.level,
      result: verification.report.result,
      graphValid: verification.report.graphValid,
      selectedTests: verification.report.selectedTests.length,
      executedTests: verification.report.executedTests.length,
      cachedTests: verification.report.cached,
    },
    timing: {
      totalMs,
      controlPlaneMs,
      changeDetectionMs: verification.timings.changeDetectionMs,
      graphMs: verification.timings.graphMs,
      impactMs: verification.timings.impactMs,
      fingerprintMs: verification.timings.fingerprintMs,
      evidenceLookupMs: verification.timings.evidenceLookupMs,
      staticMs: verification.timings.staticMs,
      vitestMs: verification.timings.vitestMs,
      turboMs: turbo.durationMs,
      profileOverheadMs,
    },
    turbo: {
      packagesInScope: turboPackageCount,
      tasks: turboTaskCount,
      successfulTasks: turboSuccessfulTasks,
      cacheHits: turbo.cacheHits,
      cacheMisses: turbo.cacheMisses,
      cacheHitRate: turboTaskCount > 0 ? turbo.cacheHits / turboTaskCount : 0,
    },
    overlap,
    result,
    artifacts: {
      profilePath: artifactPath,
      verificationReportPath: verification.reportPath,
    },
  };

  saveVerificationProfile(profile);
  return profile;
}

function printProfile(profile: VerificationProfileV1): void {
  console.log('\nVestara Verification Profile');
  console.log('');
  console.log(`SHA           ${profile.provenance.gitSha}`);
  console.log(`Fingerprint   ${profile.provenance.fingerprint}`);
  console.log(`Scenario      ${profile.benchmark.scenario.id} — ${profile.benchmark.scenario.label}`);
  console.log(`Cache         ${profile.benchmark.cacheState}`);
  console.log(`Result        ${profile.result.toUpperCase()}`);
  console.log('');
  console.log(`Wall clock                  ${formatSeconds(profile.timing.totalMs)}`);
  console.log('');
  console.log('Control plane');
  console.log(`  Change detection          ${formatSeconds(profile.timing.changeDetectionMs)}`);
  console.log(`  Graph                     ${formatSeconds(profile.timing.graphMs)}`);
  console.log(`  Impact                    ${formatSeconds(profile.timing.impactMs)}`);
  console.log(`  Fingerprint               ${formatSeconds(profile.timing.fingerprintMs)}`);
  console.log(`  Evidence lookup           ${formatSeconds(profile.timing.evidenceLookupMs)}`);
  console.log(`  Static                    ${formatSeconds(profile.timing.staticMs)}`);
  console.log(`  Vitest                    ${formatSeconds(profile.timing.vitestMs)}`);
  console.log('');
  console.log('Turbo');
  console.log(`  Packages in scope         ${profile.turbo.packagesInScope}`);
  console.log(`  Tasks                     ${profile.turbo.tasks}`);
  console.log(`  Successful                ${profile.turbo.successfulTasks}`);
  console.log(`  Cached                    ${profile.turbo.cacheHits}`);
  console.log(`  Misses                    ${profile.turbo.cacheMisses}`);
  console.log(`  Cache hit rate            ${(profile.turbo.cacheHitRate * 100).toFixed(1)}%`);
  console.log(`  Duration                  ${formatSeconds(profile.timing.turboMs)}`);
  console.log('');
  console.log('Overlap');
  console.log(`  FASTVERIFY selected       ${profile.overlap.fastVerifyTests}`);
  console.log(`  Turbo affected            ${profile.overlap.turboAffectedTests}`);
  console.log(`  Intersection              ${profile.overlap.overlappingTests}`);
  console.log(`  Overlap rate              ${(profile.overlap.overlapRate * 100).toFixed(1)}%`);
  console.log('');
  console.log('Artifacts');
  console.log(`  Verification report       ${profile.artifacts.verificationReportPath}`);
  console.log(`  Profile                   ${profile.artifacts.profilePath}`);
  console.log('');
  console.log(`Frozen scenarios            ${FROZEN_PROFILE_SCENARIOS.map((scenario) => scenario.id).join(', ')}`);
  console.log('');
}

function main(): void {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(HELP);
    process.exit(0);
  }

  const jsonFlag = process.argv.includes('--json');
  const cacheStateArgIndex = process.argv.findIndex((arg) => arg === '--cache-state' || arg.startsWith('--cache-state='));
  const cacheState =
    cacheStateArgIndex >= 0
      ? process.argv[cacheStateArgIndex]!.includes('=')
        ? (process.argv[cacheStateArgIndex]!.split('=', 2)[1] as ProfileCacheState)
        : ((process.argv[cacheStateArgIndex + 1] ?? 'cold') as ProfileCacheState)
      : 'cold';
  const profile = runVerificationProfile(cacheState === 'warm' ? 'warm' : 'cold');

  if (jsonFlag) {
    console.log(JSON.stringify(profile, null, 2));
  } else {
    printProfile(profile);
  }

  process.exit(profile.result === 'pass' ? 0 : 1);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
