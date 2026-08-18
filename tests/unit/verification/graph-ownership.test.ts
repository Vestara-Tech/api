import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { buildVerificationGraph } from '../../../scripts/verification/graph/index.js';
import { buildOwnershipIndex, ownershipIssues } from '../../../scripts/verification/graph/ownership.js';
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
  const root = mkdtempSync(join(tmpdir(), 'vestara-graph-ownership-'));
  for (const [rel, content] of Object.entries(files)) {
    const file = join(root, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content, 'utf8');
  }
  return root;
}

describe('verification graph ownership', () => {
  it('assigns a single accountable owner to overlapping test files', () => {
    const repo = createRepo({
      'src/agent/index.ts': 'export const agent = true;',
      'src/skill/index.ts': 'export const skill = true;',
      'src/tool/index.ts': 'export const tool = true;',
      'tests/unit/agent-platform.test.ts': 'export {};',
    });

    const graphResult = buildVerificationGraph(
      repo,
      baseConfig({
        agent: {
          sources: ['src/agent/**'],
          tests: ['tests/unit/agent*.test.ts'],
          cwd: 'src/agent',
        },
        skill: {
          sources: ['src/skill/**'],
          tests: ['tests/unit/agent-platform.test.ts'],
          cwd: 'src/skill',
        },
        tool: {
          sources: ['src/tool/**'],
          tests: ['tests/unit/agent-platform.test.ts'],
          cwd: 'src/tool',
        },
      }),
    );

    expect(graphResult.valid).toBe(true);
    expect(graphResult.issues.some((issue) => issue.code === 'VGRAPH_DUPLICATE_TEST_OWNERSHIP')).toBe(false);

    const ownership = buildOwnershipIndex(repo, graphResult.graph!);
    expect(ownership.tests.unowned).toEqual([]);
    expect(ownership.tests.ambiguous).toEqual([]);
    expect(ownership.tests.byFile.get('tests/unit/agent-platform.test.ts')).toHaveLength(1);

    const issues = ownershipIssues(ownership, 'strict');
    expect(issues.some((issue) => issue.code === 'VGRAPH_DUPLICATE_TEST_OWNERSHIP')).toBe(false);
  });
});
