import { spawnSync } from 'node:child_process';
import { join, relative } from 'node:path';

import {
  detectPackageManager,
  findDependencyFiles,
  findSourceFiles,
  findTestFiles,
  gitChangedFiles,
  loadConfig,
  REPO_ROOT,
  type Scope,
} from './affected.ts';
import {
  appendTelemetry,
  currentToolchain,
  evidencePath,
  loadEvidence,
  saveEvidence,
  writeReport,
  type Evidence,
  type VerificationReport,
} from './evidence.ts';
import { computeFingerprint } from './fingerprint.ts';
import { computeImpact, moduleTests, type ImpactLevel } from './impact.ts';
import { matchAnyGlob } from './glob.ts';

interface StepResult {
  name: string;
  command: string;
  passed: boolean;
  durationMs: number;
  output: string;
}

interface TestSummary {
  filesTotal: number;
  filesFailed: number;
  testsTotal: number;
  testsPassed: number;
  testsFailed: number;
  testsErrored: number;
}

interface RunResult {
  steps: StepResult[];
  executedTests: string[];
  reusedTests: string[];
  cached: number;
  testSummary: TestSummary | null;
  passed: boolean;
}

const HELP = `Usage: pnpm verify [scope] [--json] [--no-cache] [module-name]

Scopes:
  static    V0 static verification (tsc -p tsconfig.json --noEmit)
  affected  V1 affected verification (default)
  module    V2 module verification; optional module filter argument
  platform  V3 platform verification (static + full suite)

Aliases: V0, V1, V2, V3.
Flags: --json      machine-readable report
       --no-cache  force execution, bypassing reusable evidence`;

function resolveScope(raw: string | undefined, defaultScope: Scope): Scope {
  if (!raw) return defaultScope;
  const aliases: Record<string, Scope> = { V0: 'static', V1: 'affected', V2: 'module', V3: 'platform' };
  return aliases[raw.toUpperCase()] ?? (raw as Scope);
}

function runStep(name: string, command: string[], cwd = REPO_ROOT, timeoutMs = 1_800_000): StepResult {
  const start = Date.now();
  const result = spawnSync(command[0]!, command.slice(1), { cwd, encoding: 'utf8', timeout: timeoutMs });
  return {
    name,
    command: command.join(' '),
    passed: result.status === 0,
    durationMs: Date.now() - start,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

function parseCounts(line: string): { total: number; passed: number; failed: number } {
  const statuses = { passed: 0, failed: 0 };
  const totalMatch = line.match(/\(([\d,]+)\)/);
  const total = totalMatch ? Number(totalMatch[1]!.replace(/,/g, '')) : 0;
  for (const match of line.matchAll(/(\d+)\s+(passed|failed)/g)) {
    statuses[match[2] as 'passed' | 'failed'] += Number(match[1]);
  }
  return { total, passed: statuses.passed, failed: statuses.failed };
}

function parseVitestSummary(output: string): TestSummary | null {
  const filesMatch = output.match(/^\s*Test Files\s+(.+)$/m);
  const testsMatch = output.match(/^\s*Tests\s+(.+)$/m);
  const errorsMatch = output.match(/^\s*Errors\s+(\d+)/m);
  if (!filesMatch && !testsMatch) return null;
  const files = filesMatch ? parseCounts(filesMatch[1]!) : { total: 0, passed: 0, failed: 0 };
  const tests = testsMatch ? parseCounts(testsMatch[1]!) : { total: 0, passed: 0, failed: 0 };
  return {
    filesTotal: files.total,
    filesFailed: files.failed,
    testsTotal: tests.total,
    testsPassed: tests.passed,
    testsFailed: tests.failed,
    testsErrored: errorsMatch ? Number(errorsMatch[1]) : 0,
  };
}

function staticStep(pm: 'pnpm' | 'npm', cwd = REPO_ROOT): StepResult {
  return runStep('static', [pm, 'exec', 'tsc', '-p', 'tsconfig.json'], cwd);
}

function vitestStep(pm: 'pnpm' | 'npm', files: string[], passWithNoTests: boolean, cwd = REPO_ROOT): StepResult {
  const args = ['exec', 'vitest', 'run'];
  const selected = cwd === REPO_ROOT
    ? files
    : files
        .map((file) => relative(cwd, join(REPO_ROOT, file)).split('\\').join('/'))
        .filter((file) => file.length > 0 && !file.startsWith('..'));
  if (selected.length > 0) args.push(...selected);
  if (passWithNoTests) args.push('--passWithNoTests');
  return runStep('tests', [pm, ...args], cwd);
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function printReport(report: VerificationReport): void {
  console.log('\nVestara Verification');
  console.log(`Level: ${report.level} — ${report.scope}`);
  console.log('');

  if (report.changedFiles.length > 0) {
    console.log('Changed');
    for (const file of report.changedFiles) console.log(`  ${file}`);
    console.log('');
  }

  if (report.affectedModules.length > 0) {
    console.log('Impact');
    for (const module of report.affectedModules) console.log(`  ${module}`);
    console.log('');
  }

  if (report.selectedTests.length > 0) {
    console.log(`Selected ${report.selectedTests.length} tests`);
  }

  if (report.cached > 0) {
    console.log(`Evidence: ${report.cached} cached${report.evidence ? ` (${report.evidence})` : ''}`);
    console.log('');
    console.log('CACHED PASS');
  } else {
    console.log('Evidence: 0 cached');
    if (report.executedTests.length > 0) {
      console.log('');
      console.log('Executing');
      for (const file of report.executedTests.slice(0, 12)) console.log(`  ${file}`);
      if (report.executedTests.length > 12) console.log(`  ... +${report.executedTests.length - 12} more`);
    }
  }

  if (!report.verified) {
    console.log('');
    console.log('NO TESTS EXECUTED — static verification only. Do not claim test verification.');
  }

  const summary = report.executedTests.length > 0 || report.cached > 0 ? report : null;
  console.log('');
  if (summary) {
    console.log(`Result:   ${report.result.toUpperCase()}`);
    console.log(`Executed  ${summary.executedTests.length}`);
    console.log(`Cached    ${report.cached}`);
    console.log(`Failed    ${report.failed}`);
  } else {
    console.log(`Result:   ${report.result.toUpperCase()} (static)`);
  }
  console.log(`Duration  ${formatSeconds(report.durationMs)}`);

  if (report.escalated) {
    console.log('');
    console.log('Escalation');
    for (const reason of report.escalationReasons) console.log(`  ${reason}`);
  }
  console.log('');
}

function main(): void {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(HELP);
    process.exit(0);
  }

  const jsonFlag = process.argv.includes('--json');
  const noCache = process.argv.includes('--no-cache');
  const positional = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));

  const config = loadConfig(REPO_ROOT);
  const pm = detectPackageManager(REPO_ROOT);
  const scope = resolveScope(positional[0], config.defaultLevel);
  const moduleName = positional[1];
  const moduleDefinition = moduleName ? config.modules[moduleName] : undefined;
  const moduleCwd = moduleDefinition?.cwd ? join(REPO_ROOT, moduleDefinition.cwd) : REPO_ROOT;

  const start = Date.now();
  const changed = gitChangedFiles(REPO_ROOT);
  const allTestFiles = findTestFiles(REPO_ROOT);
  const dependencyFiles = findDependencyFiles(REPO_ROOT, config);

  let level: ImpactLevel = 'V0';
  let sourceFiles: string[] = [];
  let selectedTests: string[] = [];
  let affectedModules: string[] = [];
  let escalationReasons: string[] = [];
  let escalated = false;

  if (scope === 'static') {
    level = 'V0';
  } else if (scope === 'affected') {
    const impact = computeImpact(REPO_ROOT, changed, config);
    level = impact.level;
    affectedModules = [...impact.directlyAffectedModules, ...impact.transitivelyAffectedModules];
    escalationReasons = impact.reasons;
    escalated = impact.level !== 'V1';
    sourceFiles = impact.changedFiles;
    selectedTests = impact.selectedTests;
    if (impact.level === 'V3') {
      selectedTests = allTestFiles;
    }
  } else if (scope === 'module') {
    level = 'V2';
    if (moduleName) {
      if (config.modules[moduleName]) {
        affectedModules = [moduleName];
        selectedTests = moduleTests(moduleName, config, allTestFiles);
        sourceFiles = findSourceFiles(REPO_ROOT).filter((f) => matchAnyGlob(config.modules[moduleName]!.sources, f));
      } else {
        selectedTests = [moduleName];
        sourceFiles = changed;
      }
    } else {
      selectedTests = allTestFiles;
      sourceFiles = findSourceFiles(REPO_ROOT);
    }
  } else {
    level = 'V3';
    sourceFiles = findSourceFiles(REPO_ROOT);
    selectedTests = allTestFiles;
  }

  const fingerprint = computeFingerprint({
    level,
    scope,
    sourceFiles,
    testFiles: selectedTests,
    dependencyFiles,
  });

  const cachedEvidence: Evidence | null =
    !noCache && config.reuseEvidence ? loadEvidence(fingerprint) : null;
  const canReuse = cachedEvidence !== null && cachedEvidence.result === 'pass' && cachedEvidence.tests.length > 0;

  let runResult: RunResult;
  if (canReuse) {
    runResult = {
      steps: [],
      executedTests: [],
      reusedTests: cachedEvidence.tests,
      cached: cachedEvidence.tests.length,
      testSummary: null,
      passed: true,
    };
  } else {
    const steps: StepResult[] = [];
    const staticCheck = staticStep(pm, moduleCwd);
    steps.push(staticCheck);

    const hasTests = selectedTests.length > 0 || scope === 'platform';
    let executedTests: string[] = [];

    if (staticCheck.passed && hasTests) {
      const zeroTests = allTestFiles.length === 0;
      const files = scope === 'platform' || (scope === 'affected' && level === 'V3') ? [] : selectedTests;
      const testStep = vitestStep(pm, files, zeroTests, moduleCwd);
      steps.push(testStep);
      executedTests = files.length > 0 ? files : allTestFiles;
    }

    const testSummary = parseVitestSummary(steps.map((s) => s.output).join('\n'));
    runResult = {
      steps,
      executedTests,
      reusedTests: [],
      cached: 0,
      testSummary,
      passed: steps.every((s) => s.passed),
    };
  }

  const executed = runResult.executedTests.length;
  const summary = runResult.testSummary;
  const passedCount = summary?.testsPassed ?? 0;
  const failedCount = (summary?.testsFailed ?? 0) + (summary?.testsErrored ?? 0);

  const verified = executed > 0 || runResult.cached > 0;
  const result: 'pass' | 'fail' = runResult.passed ? 'pass' : 'fail';

  const report: VerificationReport = {
    version: 1,
    level,
    scope,
    changedFiles: changed,
    affectedModules,
    selectedTests,
    executedTests: runResult.executedTests,
    reusedTests: runResult.reusedTests,
    skippedTests: [],
    passed: passedCount,
    failed: failedCount,
    cached: runResult.cached,
    escalated,
    escalationReasons,
    durationMs: Date.now() - start,
    result,
    verified,
    evidence: verified ? fingerprint : null,
  };

  if (verified && result === 'pass') {
    saveEvidence({
      fingerprint,
      level,
      scope,
      modules: affectedModules,
      tests: selectedTests,
      result,
      durationMs: report.durationMs,
      createdAt: new Date().toISOString(),
      toolchain: currentToolchain(),
    });
  }

  const reportPath = writeReport(report);

  appendTelemetry({
    ts: new Date().toISOString(),
    level,
    scope,
    changed: changed.length,
    selected: selectedTests.length,
    executed,
    cached: runResult.cached,
    escalated,
    durationMs: report.durationMs,
    result,
  });

  if (jsonFlag) {
    console.log(JSON.stringify({ ...report, reportPath, fingerprint }, null, 2));
  } else {
    printReport(report);
    console.log(`Report: ${reportPath}`);
    if (fingerprint) console.log(`Fingerprint: ${fingerprint}`);
  }

  process.exit(report.result === 'pass' ? 0 : 1);
}

main();
