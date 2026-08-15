import { describe, expect, it } from 'vitest';
import { DiagnosticRegistry, DiagnosticExecutor, systemDiagnostics, imageBuilderDiagnostics } from '../../src/diagnostics/index.js';
import { ImageBuildService } from '../../src/image/service/image-build-service.js';

function buildExecutor(env: Record<string, unknown> = {}) {
  const registry = new DiagnosticRegistry();
  registry.register(systemDiagnostics);
  const executor = new DiagnosticExecutor(registry, env);
  return { registry, executor };
}

describe('DIAG-003 registry', () => {
  it('lists contributed checks', () => {
    const { registry } = buildExecutor();
    const checks = registry.listChecks();
    expect(checks.some((c) => c.checkId === 'system.api.health')).toBe(true);
  });
});

describe('DIAG-004/005 run executor', () => {
  it('runs a system scope and produces findings', async () => {
    const { executor } = buildExecutor({ apiProcessUp: true });
    const run = await executor.run({ scope: 'system' });
    expect(['completed', 'partial']).toContain(run.status);
    expect(run.checks.length).toBeGreaterThan(0);
    expect(run.counts.healthy).toBeGreaterThan(0);
    expect(run.findings.length).toBeGreaterThanOrEqual(0);
    expect(executor.listRuns()).toHaveLength(1);
  });

  it('reports API failure as a critical finding', async () => {
    const { executor } = buildExecutor({});
    const run = await executor.run({ scope: 'system' });
    const apiCheck = run.checks.find((c) => c.checkId === 'system.api.health')!;
    expect(apiCheck.status).toBe('fail');
    expect(apiCheck.severity).toBe('critical');
  });
});

describe('DIAG-015 Image Builder diagnostics (OSIB dogfood)', () => {
  it('reports healthy profiles when profiles load', async () => {
    const registry = new DiagnosticRegistry();
    const image = new ImageBuildService();
    registry.register(imageBuilderDiagnostics(image));
    const executor = new DiagnosticExecutor(registry, { VESTARA_API_URL: 'http://localhost:4310' });
    const run = await executor.run({ scope: 'module', target: 'image-builder', moduleId: 'image-builder' });
    const profileCheck = run.checks.find((c) => c.checkId === 'image-builder.profile.load')!;
    expect(profileCheck.status).toBe('pass');
    expect(profileCheck.detail).toContain('vestara-desktop');
  });

  it('reports degraded when no profiles are registered', async () => {
    const registry = new DiagnosticRegistry();
    const image = new ImageBuildService();
    // Remove default profiles by registering an empty registry is not possible;
    // instead a fresh service with defaults is healthy. Simulate empty via a
    // stub service that returns [].
    const stub = { listProfiles: () => [] } as unknown as ImageBuildService;
    registry.register(imageBuilderDiagnostics(stub));
    const executor = new DiagnosticExecutor(registry, {});
    const run = await executor.run({ scope: 'module', moduleId: 'image-builder' });
    const profileCheck = run.checks.find((c) => c.checkId === 'image-builder.profile.load')!;
    expect(profileCheck.status).toBe('degraded');
    expect(profileCheck.severity).toBe('warning');
  });
});
