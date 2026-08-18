import { describe, expect, it } from 'vitest';

import {
  buildCommitBody,
  buildVerificationBody,
  isAllowedPath,
  partitionPaths,
  resolveDocsBranchName,
  type VerificationSummary,
} from '../../scripts/git/docs-automation.js';

const verification: VerificationSummary = {
  level: 'V1',
  scope: 'affected',
  result: 'pass',
  cached: 2,
  executed: 4,
  durationMs: 1280,
  reportPath: '.vestara/evidence/verification/latest.json',
  fingerprint: 'sha256:1234abcd',
  verified: true,
};

describe('docs git automation', () => {
  it('accepts exact and prefix-allowed paths', () => {
    expect(isAllowedPath('README.md', ['README.md'])).toBe(true);
    expect(isAllowedPath('docs/automation/generated/platform-summary.md', ['docs/automation/'])).toBe(true);
    expect(isAllowedPath('docs/plans/roadmap.md', ['docs/automation/'])).toBe(false);
  });

  it('partitions allowed and rejected paths', () => {
    const result = partitionPaths(
      ['README.md', 'docs/automation/generated/platform-summary.md', 'docs/plans/roadmap.md'],
      ['README.md', 'docs/automation/'],
    );

    expect(result.allowed).toEqual(['README.md', 'docs/automation/generated/platform-summary.md']);
    expect(result.rejected).toEqual(['docs/plans/roadmap.md']);
  });

  it('derives a safe agent branch name from a commit message', () => {
    expect(resolveDocsBranchName('docs: refresh generated documentation')).toBe('agent/docs-refresh-generated-documentation');
  });

  it('formats the verification summary for commit bodies', () => {
    const body = buildVerificationBody(['pnpm docs:verify --targets=summary,readme', 'pnpm verify:affected --json'], verification);

    expect(body).toContain('Verification:');
    expect(body).toContain('pnpm docs:verify --targets=summary,readme');
    expect(body).toContain('Result: PASS');
    expect(body).toContain('Fingerprint: sha256:1234abcd');
    expect(body).toContain('Report: .vestara/evidence/verification/latest.json');
  });

  it('formats the final commit body with updated paths and verification evidence', () => {
    const body = buildCommitBody(
      ['README.md', 'docs/automation/generated/platform-summary.md'],
      ['pnpm docs:verify --targets=summary,readme', 'pnpm verify:affected --json'],
      verification,
    );

    expect(body).toContain('Automated documentation sync.');
    expect(body).toContain('README.md');
    expect(body).toContain('docs/automation/generated/platform-summary.md');
    expect(body).toContain('Cached: 2');
    expect(body).toContain('Executed tests: 4');
  });
});
