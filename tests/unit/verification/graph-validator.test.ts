import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { classifyFiles, findTestFiles, type VerificationConfig } from '../../../scripts/verification/affected.js';
import { buildVerificationGraph } from '../../../scripts/verification/graph/index.js';
import { computeImpact } from '../../../scripts/verification/impact.js';

function baseConfig(modules: VerificationConfig['modules'], aliases: VerificationConfig['aliases'] = {}): VerificationConfig {
  return {
    version: 2,
    defaultLevel: 'affected',
    levels: { V0: 'static', V1: 'affected', V2: 'module', V3: 'platform' },
    aliases,
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
  const root = mkdtempSync(join(tmpdir(), 'vestara-graph-'));
  for (const [rel, content] of Object.entries(files)) {
    const file = join(root, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content, 'utf8');
  }
  return root;
}

describe('verification graph validation', () => {
  it('accepts a valid graph and preserves canonical module coverage', () => {
    const repo = createRepo({
      'packages/configuration/package.json': '{}',
      'packages/configuration/src/index.ts': 'export const configuration = true;',
      'packages/configuration/tests/configuration.test.ts': 'export {};',
      'packages/auth/package.json': '{}',
      'packages/auth/src/index.ts': 'export const auth = true;',
      'packages/auth/tests/auth.test.ts': 'export {};',
    });

    const result = buildVerificationGraph(
      repo,
      baseConfig({
        configuration: {
          sources: ['packages/configuration/src/**'],
          tests: ['packages/configuration/tests/**/*.test.ts'],
          cwd: 'packages/configuration',
        },
        auth: {
          sources: ['packages/auth/src/**'],
          tests: ['packages/auth/tests/**/*.test.ts'],
          dependsOn: ['configuration'],
          cwd: 'packages/auth',
        },
      }),
    );

    expect(result.valid).toBe(true);
    expect(result.graph).not.toBeNull();
    expect(result.issues.some((issue) => issue.severity === 'error')).toBe(false);
  });

  it('rejects the config/configuration mismatch as an unknown dependency', () => {
    const repo = createRepo({
      'packages/config/package.json': '{}',
      'packages/config/src/index.ts': 'export const config = true;',
      'packages/config/tests/config.test.ts': 'export {};',
      'packages/auth/package.json': '{}',
      'packages/auth/src/index.ts': 'export const auth = true;',
      'packages/auth/tests/auth.test.ts': 'export {};',
    });

    const result = buildVerificationGraph(
      repo,
      baseConfig({
        config: {
          sources: ['packages/config/src/**'],
          tests: ['packages/config/tests/**/*.test.ts'],
          cwd: 'packages/config',
        },
        auth: {
          sources: ['packages/auth/src/**'],
          tests: ['packages/auth/tests/**/*.test.ts'],
          dependsOn: ['configuration'],
          cwd: 'packages/auth',
        },
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'VGRAPH_UNKNOWN_DEPENDENCY')).toBe(true);
  });

  it('uses validated graph closure when computing affected modules', () => {
    const repo = createRepo({
      'packages/beta/package.json': '{}',
      'packages/beta/src/index.ts': 'export const beta = true;',
      'packages/beta/tests/beta.test.ts': 'export {};',
      'packages/alpha/package.json': '{}',
      'packages/alpha/src/index.ts': 'export const alpha = true;',
      'packages/alpha/tests/alpha.test.ts': 'export {};',
    });

    const config = baseConfig({
      alpha: {
        sources: ['packages/alpha/src/**'],
        tests: ['packages/alpha/tests/**/*.test.ts'],
        dependsOn: ['beta'],
        cwd: 'packages/alpha',
      },
      beta: {
        sources: ['packages/beta/src/**'],
        tests: ['packages/beta/tests/**/*.test.ts'],
        cwd: 'packages/beta',
      },
    });

    const graphResult = buildVerificationGraph(repo, config);
    expect(graphResult.valid).toBe(true);
    expect(graphResult.graph).not.toBeNull();

    const changed = ['packages/beta/src/index.ts'];
    const classification = classifyFiles(changed, config);
    const impact = computeImpact(changed, classification, graphResult.graph!, findTestFiles(repo));

    expect(impact.directlyAffectedModules).toEqual(['beta']);
    expect(impact.transitivelyAffectedModules).toEqual(['alpha']);
    expect(impact.selectedTests).toEqual([
      'packages/alpha/tests/alpha.test.ts',
      'packages/beta/tests/beta.test.ts',
    ]);
  });

  it('rejects direct self-dependencies and dependency cycles', () => {
    const selfRepo = createRepo({
      'packages/alpha/package.json': '{}',
      'packages/alpha/src/index.ts': 'export const alpha = true;',
      'packages/alpha/tests/alpha.test.ts': 'export {};',
    });
    const selfResult = buildVerificationGraph(
      selfRepo,
      baseConfig({
        alpha: {
          sources: ['packages/alpha/src/**'],
          tests: ['packages/alpha/tests/**/*.test.ts'],
          dependsOn: ['alpha'],
          cwd: 'packages/alpha',
        },
      }),
    );
    expect(selfResult.valid).toBe(false);
    expect(selfResult.issues.some((issue) => issue.code === 'VGRAPH_SELF_DEPENDENCY')).toBe(true);

    const cycleRepo = createRepo({
      'packages/a/package.json': '{}',
      'packages/a/src/index.ts': 'export const a = true;',
      'packages/a/tests/a.test.ts': 'export {};',
      'packages/b/package.json': '{}',
      'packages/b/src/index.ts': 'export const b = true;',
      'packages/b/tests/b.test.ts': 'export {};',
    });
    const cycleResult = buildVerificationGraph(
      cycleRepo,
      baseConfig({
        a: { sources: ['packages/a/src/**'], tests: ['packages/a/tests/**/*.test.ts'], dependsOn: ['b'], cwd: 'packages/a' },
        b: { sources: ['packages/b/src/**'], tests: ['packages/b/tests/**/*.test.ts'], dependsOn: ['a'], cwd: 'packages/b' },
      }),
    );
    expect(cycleResult.valid).toBe(false);
    expect(cycleResult.issues.some((issue) => issue.code === 'VGRAPH_DEPENDENCY_CYCLE')).toBe(true);
  });

  it('rejects duplicate ownership, missing test coverage, and invalid cwd values', () => {
    const repo = createRepo({
      'packages/shared/package.json': '{}',
      'packages/shared/src/shared.ts': 'export const shared = true;',
      'packages/shared/tests/alpha.test.ts': 'export {};',
      'packages/shared/tests/beta.test.ts': 'export {};',
      'packages/missing/package.json': '{}',
      'packages/missing/src/index.ts': 'export const missing = true;',
      'packages/unused/package.json': '{}',
      'packages/unused/src/index.ts': 'export const unused = true;',
    });

    const result = buildVerificationGraph(
      repo,
      baseConfig({
        alpha: {
          sources: ['packages/shared/src/shared.ts'],
          tests: ['packages/shared/tests/alpha.test.ts'],
          cwd: 'packages/shared',
        },
        beta: {
          sources: ['packages/shared/src/shared.ts'],
          tests: ['packages/shared/tests/beta.test.ts'],
          cwd: 'packages/shared',
        },
        missing: {
          sources: ['packages/missing/src/**'],
          tests: ['packages/missing/tests/**/*.test.ts'],
          cwd: 'packages/missing',
        },
        invalid: {
          sources: ['packages/unused/src/**'],
          tests: ['packages/unused/tests/**/*.test.ts'],
          cwd: '../outside',
        },
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'VGRAPH_DUPLICATE_SOURCE_OWNERSHIP')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'VGRAPH_MISSING_TEST_COVERAGE')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'VGRAPH_INVALID_CWD')).toBe(true);
  });

  it('reports workspace roots that are not represented by the graph', () => {
    const repo = createRepo({
      'packages/alpha/package.json': '{}',
      'packages/alpha/src/index.ts': 'export const alpha = true;',
      'packages/alpha/tests/alpha.test.ts': 'export {};',
      'packages/unused/package.json': '{}',
      'packages/unused/src/index.ts': 'export const unused = true;',
    });

    const result = buildVerificationGraph(
      repo,
      baseConfig({
        alpha: {
          sources: ['packages/alpha/src/**'],
          tests: ['packages/alpha/tests/**/*.test.ts'],
          cwd: 'packages/alpha',
        },
      }),
    );

    expect(result.valid).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'VGRAPH_WORKSPACE_ROOT_UNMAPPED')).toBe(true);
    expect(result.issues.some((issue) => issue.severity === 'warning')).toBe(true);
  });
});
