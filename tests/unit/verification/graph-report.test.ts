import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { buildGraphReport } from '../../../scripts/verification/graph/report.js';
import type { VerificationConfig } from '../../../scripts/verification/affected.js';

function baseConfig(modules: VerificationConfig['modules']): VerificationConfig {
  return {
    version: 2,
    defaultLevel: 'affected',
    levels: { V0: 'static', V1: 'affected', V2: 'module', V3: 'platform' },
    aliases: {},
    fullVerificationTriggers: ['package.json'],
    neverWatch: true,
    reuseEvidence: true,
    escalateOnUnknownImpact: true,
    contractPatterns: ['contracts/**'],
    sharedModules: ['core', 'bootstrap'],
    modules,
  };
}

function createRepo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'vestara-graph-report-'));
  for (const [rel, content] of Object.entries(files)) {
    const file = join(root, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content, 'utf8');
  }
  return root;
}

describe('verification graph report', () => {
  it('reports a valid graph with complete ownership and closure detail', () => {
    const repo = createRepo({
      'packages/alpha/package.json': '{}',
      'packages/alpha/src/index.ts': 'export const alpha = true;',
      'packages/alpha/tests/alpha.test.ts': 'export {};',
      'contracts/openapi/spec.yaml': 'openapi: 3.0.0',
      'tests/contract/openapi.test.ts': 'export {};',
    });

    const report = buildGraphReport(
      repo,
      baseConfig({
        alpha: {
          sources: ['packages/alpha/src/**'],
          tests: ['packages/alpha/tests/**/*.test.ts'],
          dependsOn: ['contracts'],
          cwd: 'packages/alpha',
        },
        contracts: {
          sources: ['contracts/**'],
          tests: ['tests/contract/**/*.test.ts'],
        },
      }),
    );

    expect(report.status).toBe('VALID');
    expect(report.result).toBe('PASS');
    expect(report.graph.modules).toBe(2);
    expect(report.graph.dependencies).toBe(1);
    expect(report.graph.aliases).toBe(0);
    expect(report.graph.moduleDetails.find((module) => module.id === 'contracts')?.closure).toEqual(['alpha']);
    expect(report.ownership.production.ignored).toBeGreaterThan(0);
    expect(report.ownership.workspace.covered).toBe(1);
    expect(report.ownership.workspace.total).toBe(1);
    expect(report.errors).toBe(0);
  });

  it('fails the strict report when production roots are unowned', () => {
    const repo = createRepo({
      'packages/alpha/package.json': '{}',
      'packages/alpha/src/index.ts': 'export const alpha = true;',
      'packages/alpha/tests/alpha.test.ts': 'export {};',
      'packages/beta/package.json': '{}',
      'packages/beta/src/missing.ts': 'export const missing = true;',
    });

    const report = buildGraphReport(
      repo,
      baseConfig({
        alpha: {
          sources: ['packages/alpha/src/**'],
          tests: ['packages/alpha/tests/**/*.test.ts'],
          cwd: 'packages/alpha',
        },
      }),
    );

    expect(report.status).toBe('VALID');
    expect(report.result).toBe('FAIL');
    expect(report.ownership.production.unownedPaths).toContain('packages/beta/src/missing.ts');
    expect(report.ownership.workspace.uncoveredRoots).toContain('packages/beta');
    expect(report.issues.some((issue) => issue.code === 'VGRAPH_UNOWNED_PRODUCTION_FILE')).toBe(true);
    expect(report.issues.some((issue) => issue.code === 'VGRAPH_WORKSPACE_ROOT_UNMAPPED')).toBe(true);
  });
});
