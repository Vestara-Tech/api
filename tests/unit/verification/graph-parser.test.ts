import { describe, expect, it } from 'vitest';

import { parseVerificationGraph } from '../../../scripts/verification/graph/index.js';
import type { VerificationConfig } from '../../../scripts/verification/affected.js';

function baseConfig(): VerificationConfig {
  return {
    version: 2,
    defaultLevel: 'affected',
    levels: { V0: 'static', V1: 'affected', V2: 'module', V3: 'platform' },
    aliases: { legacyAlpha: 'alpha', legacyBeta: 'beta' },
    fullVerificationTriggers: ['package.json'],
    neverWatch: true,
    reuseEvidence: true,
    escalateOnUnknownImpact: true,
    contractPatterns: ['contracts/**'],
    sharedModules: ['core', 'bootstrap'],
    modules: {
      beta: { sources: ['src/beta/**'], tests: ['tests/beta.test.ts'], dependsOn: ['alpha'] },
      alpha: { sources: ['src/alpha/**'], tests: ['tests/alpha.test.ts'] },
    },
  };
}

describe('verification graph parser', () => {
  it('parses modules and aliases deterministically', () => {
    const parsed = parseVerificationGraph(baseConfig());

    expect(parsed.modules.map((module) => module.id)).toEqual(['alpha', 'beta']);
    expect(parsed.modules[0]).toEqual({
      id: 'alpha',
      sources: ['src/alpha/**'],
      tests: ['tests/alpha.test.ts'],
      dependsOn: [],
      cwd: undefined,
    });
    expect([...parsed.aliases.entries()]).toEqual([
      ['legacyAlpha', 'alpha'],
      ['legacyBeta', 'beta'],
    ]);
  });

  it('preserves module dependency lists before normalization', () => {
    const parsed = parseVerificationGraph(baseConfig());

    const beta = parsed.modules.find((module) => module.id === 'beta');
    expect(beta?.dependsOn).toEqual(['alpha']);
  });
});
