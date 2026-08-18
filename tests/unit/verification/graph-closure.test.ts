import { describe, expect, it } from 'vitest';

import { dependencyClosure, moduleTests, normalizeVerificationGraph, parseVerificationGraph } from '../../../scripts/verification/graph/index.js';
import { toModuleId } from '../../../scripts/verification/graph/types.js';
import type { VerificationConfig } from '../../../scripts/verification/affected.js';

function baseConfig(): VerificationConfig {
  return {
    version: 2,
    defaultLevel: 'affected',
    levels: { V0: 'static', V1: 'affected', V2: 'module', V3: 'platform' },
    aliases: { legacyBeta: 'beta' },
    fullVerificationTriggers: ['package.json'],
    neverWatch: true,
    reuseEvidence: true,
    escalateOnUnknownImpact: true,
    contractPatterns: ['contracts/**'],
    sharedModules: ['core', 'bootstrap'],
    modules: {
      alpha: { sources: ['src/alpha/**'], tests: ['tests/alpha.test.ts'], dependsOn: ['beta'] },
      beta: { sources: ['src/beta/**'], tests: ['tests/beta.test.ts'], dependsOn: ['gamma'] },
      gamma: { sources: ['src/gamma/**'], tests: ['tests/gamma.test.ts'], dependsOn: ['delta'] },
      delta: { sources: ['src/delta/**'], tests: ['tests/delta.test.ts'] },
    },
  };
}

describe('verification graph closure', () => {
  it('collects the full downstream closure of a dependency chain', () => {
    const graph = normalizeVerificationGraph(parseVerificationGraph(baseConfig())).graph;

    expect(dependencyClosure(graph, [toModuleId('delta')]).map(String)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('deduplicates diamonds in the downstream closure', () => {
    const graph = normalizeVerificationGraph(
      parseVerificationGraph({
        ...baseConfig(),
        modules: {
          a: { sources: ['src/a/**'], tests: ['tests/a.test.ts'], dependsOn: ['b', 'c'] },
          b: { sources: ['src/b/**'], tests: ['tests/b.test.ts'], dependsOn: ['d'] },
          c: { sources: ['src/c/**'], tests: ['tests/c.test.ts'], dependsOn: ['d'] },
          d: { sources: ['src/d/**'], tests: ['tests/d.test.ts'] },
        },
      }),
    ).graph;

    expect(dependencyClosure(graph, [toModuleId('d')]).map(String)).toEqual(['a', 'b', 'c']);
  });

  it("resolves a module's test files from canonical or aliased names", () => {
    const graph = normalizeVerificationGraph(parseVerificationGraph(baseConfig())).graph;
    const knownTests = ['tests/alpha.test.ts', 'tests/beta.test.ts', 'tests/gamma.test.ts', 'tests/delta.test.ts'];

    expect(moduleTests(graph, 'legacyBeta', knownTests)).toEqual(['tests/beta.test.ts']);
    expect(moduleTests(graph, 'beta', knownTests)).toEqual(['tests/beta.test.ts']);
  });
});
