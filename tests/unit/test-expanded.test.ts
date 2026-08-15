import { describe, expect, it } from 'vitest';
import { TestService, TestRunnerRegistry, VitestAdapter, HttpTestAdapter, CoverageEngine, FlakinessAnalyzer, BaselineEngine, ImpactAnalyzer, buildEvidenceBundle, hashResults, type TestDefinition, type TestRun } from '../../src/test/index.js';

function def(id: string, type: TestDefinition['type'], runnerId: string, params: Record<string, unknown> = {}, outcome?: 'pass' | 'fail'): TestDefinition {
  return {
    id, name: id, type, target: 'module', runnerId,
    requirements: [], parameters: { ...params, ...(outcome !== undefined ? { outcome } : {}) },
    tags: [], artifactRequirements: [], evidenceRequirements: [], metadata: {},
  };
}

function buildService() {
  const registry = new TestRunnerRegistry();
  registry.register(new VitestAdapter());
  registry.register(new HttpTestAdapter());
  const service = new TestService({ registry });
  return { registry, service };
}

describe('TEST-007 runner registry', () => {
  it('resolves a runner per type via capabilities', () => {
    const { registry } = buildService();
    expect(registry.resolveFor('unit').id).toBe('vitest');
    expect(registry.resolveFor('api').id).toBe('http');
  });
});

describe('TEST-002/003 suites + plans + profiles', () => {
  it('creates suites, profiles and plans', () => {
    const { service } = buildService();
    service.createSuite({ id: 's1', name: 'API', tests: [def('t1', 'api', 'http', { path: '/health', expectedStatus: 200 })] });
    service.createProfile({ id: 'quick', name: 'Quick', types: ['api'], tags: [] });
    service.createPlan({ id: 'p1', name: 'Release', objective: 'verify', target: 'api', suiteIds: ['s1'], profileId: 'quick' });
    expect(service.listSuites()).toHaveLength(1);
    expect(service.listProfiles()).toHaveLength(1);
    expect(service.listPlans()).toHaveLength(1);
  });
});

describe('TEST-016 normalized execution', () => {
  it('runs a suite under a profile and normalizes results', async () => {
    const { service } = buildService();
    service.createSuite({
      id: 's2', name: 'Mixed',
      tests: [
        def('u1', 'unit', 'vitest', {}, 'pass'),
        def('u2', 'unit', 'vitest', {}, 'fail'),
        def('a1', 'api', 'http', { path: '/health', expectedStatus: 200 }),
      ],
    });
    service.createProfile({ id: 'dev', name: 'Dev', types: ['unit', 'api'], tags: [] });
    const run = await service.run('s2', 'dev');
    expect(run.summary.total).toBe(3);
    expect(run.summary.passed + run.summary.failed + run.summary.skipped).toBe(3);
    expect(run.status).toBe('finalized');
    expect(run.evidenceId).toBeTruthy();
  });
});

describe('TEST-018 coverage engine', () => {
  it('builds a report with delta and threshold', () => {
    const engine = new CoverageEngine();
    const report = engine.build({ lines: 87, branches: 80, functions: 90, statements: 88, baseline: 70, thresholds: 85 });
    expect(report.lines).toBe(87);
    expect(report.delta).toBe(17);
    expect(engine.meetsThreshold(report, 85)).toBe(true);
  });
});

describe('TEST-019 flaky analysis', () => {
  it('computes flakiness from attempt history', () => {
    const analyzer = new FlakinessAnalyzer();
    const history = Array.from({ length: 20 }, (_, i) => ({ testId: 'flaky', status: i % 5 === 0 ? 'failed' as const : 'passed' as const, at: `t${i}` }));
    const result = analyzer.analyze(history)!;
    expect(result.runs).toBe(20);
    expect(result.failed).toBe(4);
    expect(result.flakiness).toBe(20);
  });
});

describe('TEST-020 baseline/regression', () => {
  it('classifies a previously-passing test failing now as regression', () => {
    const engine = new BaselineEngine();
    const results = engine.compare(
      { results: [{ testId: 't1', status: 'failed' }] },
      { id: 'b1', name: 'baseline', target: 'api', passed: 1, total: 1, recordedAt: 't' },
    );
    expect(results[0]!.comparison).toBe('regression');
    expect(engine.classify(results)).toBe('regression');
  });
});

describe('TEST-022 impact analysis', () => {
  it('derives affected capabilities and tests from changed artifacts', () => {
    const analyzer = new ImpactAnalyzer();
    const result = analyzer.analyze({
      changedArtifacts: ['src/auth/service.ts'],
      capabilityOf: () => ['auth.login', 'auth.session'],
      testsOf: (capability) => (capability === 'auth.login' ? ['auth-login-1', 'auth-login-2'] : []),
    });
    expect(result.affectedCapabilities).toContain('auth.login');
    expect(result.recommendedTestCount).toBeGreaterThan(0);
  });
});

describe('TEST-023 evidence bundle', () => {
  it('produces an immutable evidence bundle with a hash', () => {
    const { service } = buildService();
    service.createSuite({ id: 's3', name: 'S', tests: [def('u1', 'unit', 'vitest', {}, 'pass')] });
    service.createProfile({ id: 'p', name: 'P', types: ['unit'], tags: [] });
    const run = service.listRuns()[0] as TestRun | undefined;
    const bundle = buildEvidenceBundle({ definitionHash: 'd1', planHash: 'p1', sourceRevision: 'rev', environment: 'dev', run: run ?? emptyRun() });
    expect(bundle.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
  });
});

function emptyRun(): TestRun {
  return {
    id: 'x', planId: 'x', profileId: 'x', target: 'x', status: 'finalized', executions: [], results: [],
    summary: { total: 0, passed: 0, failed: 0, skipped: 0 }, artifacts: [], logs: [],
    startedAt: new Date().toISOString(), completedAt: new Date().toISOString(),
  };
}

describe('hashResults', () => {
  it('is deterministic', () => {
    const results = [{ testId: 'a', status: 'passed' as const, durationMs: 1, attempt: 1, artifactIds: [], logIds: [] }];
    expect(hashResults(results)).toBe(hashResults(results));
  });
});
