import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  FROZEN_PROFILE_SCENARIOS,
  buildOverlap,
  buildProfilePath,
  parseTurboTextSummary,
} from '../../../scripts/verification/profile.js';

describe('verification profile helpers', () => {
  it('freezes the benchmark scenarios expected by CP3A', () => {
    expect(FROZEN_PROFILE_SCENARIOS.map((scenario) => scenario.id)).toEqual(['B1', 'B2', 'B3', 'B4']);
    expect(FROZEN_PROFILE_SCENARIOS[0]?.label).toBe('V3 platform');
  });

  it('builds a profile artifact path keyed by git sha and fingerprint', () => {
    const path = buildProfilePath('abc123', 'sha256:deadbeef', 'cold');
    expect(path).toBe(join(process.cwd(), '.vestara', 'evidence', 'verification', 'profiles', 'abc123', 'sha256-deadbeef-cold.json'));
  });

  it('parses Turbo summary text into execution counts', () => {
    const summary = parseTurboTextSummary([
      'Packages in scope: @vestara/admin-ui, @vestara/ui',
      'Tasks:    3 successful, 5 total',
      'Cached:    2 cached, 5 total',
    ].join('\n'));

    expect(summary.packagesInScope).toEqual(['@vestara/admin-ui', '@vestara/ui']);
    expect(summary.tasks).toBe(5);
    expect(summary.successfulTasks).toBe(3);
    expect(summary.cacheHits).toBe(2);
    expect(summary.cacheMisses).toBe(3);
  });

  it('calculates overlap between FASTVERIFY and Turbo test sets', () => {
    const overlap = buildOverlap(
      ['tests/a.test.ts', 'tests/b.test.ts', 'tests/c.test.ts'],
      ['tests/b.test.ts', 'tests/c.test.ts', 'tests/d.test.ts'],
    );

    expect(overlap.fastVerifyTests).toBe(3);
    expect(overlap.turboAffectedTests).toBe(3);
    expect(overlap.overlappingTests).toBe(2);
    expect(overlap.overlapRate).toBeCloseTo(2 / 3);
  });
});
