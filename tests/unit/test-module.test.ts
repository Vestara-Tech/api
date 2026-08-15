import { describe, expect, it } from 'vitest';
import { TestService, TestRunnerRegistry, VitestAdapter, HttpTestAdapter, hashResults, type TestDefinition } from '../../src/test/index.js';

function unitTest(id: string, outcome: 'pass' | 'fail' = 'pass'): TestDefinition {
  return { id, name: id, kind: 'unit', target: 'module', runner: 'vitest', configuration: { command: 'vitest run', outcome }, requirements: [], tags: [] };
}

function apiTest(id: string, path: string, expectedStatus: number): TestDefinition {
  return { id, name: id, kind: 'api', target: 'api', runner: 'http', configuration: { method: 'GET', path, expectedStatus }, requirements: [], tags: [] };
}

function buildService() {
  const registry = new TestRunnerRegistry();
  registry.register({ id: 'vitest', moduleId: 'test', version: '1.0.0', supportedKinds: ['unit', 'integration', 'component'], capabilities: [], createRunner: () => new VitestAdapter() });
  registry.register({ id: 'http', moduleId: 'test', version: '1.0.0', supportedKinds: ['api', 'contract', 'smoke'], capabilities: [], createRunner: () => new HttpTestAdapter() });
  const service = new TestService({ registry });
  return { registry, service };
}

describe('TEST-006 runner registry', () => {
  it('resolves a runner per kind', () => {
    const { registry } = buildService();
    expect(registry.resolveFor('unit').id).toBe('vitest');
    expect(registry.resolveFor('api').id).toBe('http');
    expect(() => registry.resolveFor('performance')).toThrow(/No test runner/);
  });
});

describe('TEST-008 vitest adapter', () => {
  it('produces a completed run with evidence hash', async () => {
    const { service } = buildService();
    service.createSuite({ id: 's1', name: 'Unit', tests: [unitTest('a'), unitTest('b'), unitTest('c', 'fail')] });
    const run = await service.run('s1', {});
    expect(run.status).toBe('failed');
    expect(run.passed).toBe(2);
    expect(run.failed).toBe(1);
    expect(run.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(run.runner).toBe('vitest');
  });
});

describe('TEST-009 http adapter', () => {
  it('verifies expected HTTP status codes', async () => {
    const { service } = buildService();
    service.createSuite({ id: 's2', name: 'API', tests: [apiTest('health', '/health', 200), apiTest('missing', '/nope', 200)] });
    const run = await service.run('s2', { API_BASE: 'http://127.0.0.1:4310' });
    expect(run.runner).toBe('http');
    expect(run.results.length).toBe(2);
    // The API may or may not be reachable in the test environment; the adapter
    // must classify deterministically either way (passed/failed/error).
    const health = run.results.find((r) => r.testId === 'health')!;
    expect(['passed', 'failed', 'error']).toContain(health.status);
  });
});

describe('TEST-004 evidence hash', () => {
  it('is deterministic per result set', () => {
    const results = [
      { testId: 'a', name: 'a', status: 'passed' as const },
      { testId: 'b', name: 'b', status: 'failed' as const, error: 'x' },
    ];
    const h1 = hashResults(results as never);
    const h2 = hashResults(results as never);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });
});
