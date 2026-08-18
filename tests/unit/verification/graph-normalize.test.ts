import { describe, expect, it } from 'vitest';

import { normalizeVerificationGraph, parseVerificationGraph } from '../../../scripts/verification/graph/index.js';
import { toModuleId } from '../../../scripts/verification/graph/types.js';
import type { VerificationConfig } from '../../../scripts/verification/affected.js';

function baseConfig(overrides: Partial<VerificationConfig> & Pick<VerificationConfig, 'modules'>): VerificationConfig {
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
    ...overrides,
  };
}

function snapshot(graph = normalizeVerificationGraph(parseVerificationGraph(baseConfig({
  modules: {
    alpha: { sources: ['src/alpha/**'], tests: ['tests/alpha.test.ts'], dependsOn: ['beta'] },
    beta: { sources: ['src/beta/**'], tests: ['tests/beta.test.ts'] },
  },
}))).graph) {
  return {
    modules: [...graph.modules.entries()].map(([id, module]) => ({
      id: String(id),
      rawId: module.rawId,
      dependsOn: module.dependsOn.map(String),
      sources: [...module.sources],
      tests: [...module.tests],
    })),
    aliases: [...graph.aliases.entries()].map(([alias, target]) => [alias, String(target)] as const),
    dependencies: [...graph.dependencies.entries()].map(([id, deps]) => [String(id), [...deps].map(String)] as const),
  };
}

describe('verification graph normalization', () => {
  it('resolves explicit aliases to canonical module ids', () => {
    const { graph, issues } = normalizeVerificationGraph(
      parseVerificationGraph(
        baseConfig({
          aliases: { config: 'configuration' },
          modules: {
            configuration: { sources: ['src/configuration/**'], tests: ['tests/configuration.test.ts'] },
            auth: { sources: ['src/auth/**'], tests: ['tests/auth.test.ts'], dependsOn: ['config'] },
          },
        }),
      ),
    );

    expect(issues.filter((issue) => issue.severity === 'error')).toHaveLength(0);
    expect(graph.aliases.get('config')).toBe(toModuleId('configuration'));
    expect([...(graph.dependencies.get(toModuleId('auth')) ?? new Set())].map(String)).toEqual(['configuration']);
  });

  it('rejects alias targets that do not exist', () => {
    const { issues } = normalizeVerificationGraph(
      parseVerificationGraph(
        baseConfig({
          aliases: { config: 'missing' },
          modules: {
            configuration: { sources: ['src/configuration/**'], tests: ['tests/configuration.test.ts'] },
          },
        }),
      ),
    );

    expect(issues.some((issue) => issue.code === 'VGRAPH_ALIAS_TARGET_MISSING')).toBe(true);
    expect(issues.some((issue) => issue.severity === 'error')).toBe(true);
  });

  it('rejects alias collisions with existing module ids', () => {
    const { issues } = normalizeVerificationGraph(
      parseVerificationGraph(
        baseConfig({
          aliases: { config: 'configuration' },
          modules: {
            config: { sources: ['src/config/**'], tests: ['tests/config.test.ts'] },
            configuration: { sources: ['src/configuration/**'], tests: ['tests/configuration.test.ts'] },
          },
        }),
      ),
    );

    expect(issues.some((issue) => issue.code === 'VGRAPH_ALIAS_COLLISION')).toBe(true);
  });

  it('normalizes deterministically regardless of raw object order', () => {
    const a = normalizeVerificationGraph(
      parseVerificationGraph(
        baseConfig({
          aliases: { zeta: 'beta', alphaLegacy: 'alpha' },
          modules: {
            beta: { sources: ['src/beta/**'], tests: ['tests/beta.test.ts'], dependsOn: ['alpha'] },
            alpha: { sources: ['src/alpha/**'], tests: ['tests/alpha.test.ts'] },
          },
        }),
      ),
    );
    const b = normalizeVerificationGraph(
      parseVerificationGraph(
        baseConfig({
          aliases: { alphaLegacy: 'alpha', zeta: 'beta' },
          modules: {
            alpha: { sources: ['src/alpha/**'], tests: ['tests/alpha.test.ts'] },
            beta: { sources: ['src/beta/**'], tests: ['tests/beta.test.ts'], dependsOn: ['alpha'] },
          },
        }),
      ),
    );

    expect(snapshot(a.graph)).toEqual(snapshot(b.graph));
  });
});
