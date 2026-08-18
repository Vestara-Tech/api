import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { readLatestVerificationReport, runVerificationCommand } from '../../src/verification/index.js';

describe('verification service bridge', () => {
  it('reads the latest verification report from the repository root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vestara-verification-'));
    await mkdir(join(root, '.vestara', 'evidence', 'verification'), { recursive: true });
    await writeFile(
      join(root, '.vestara', 'evidence', 'verification', 'latest.json'),
      JSON.stringify({
        version: 1,
        level: 'V1',
        scope: 'affected',
        result: 'pass',
        graphValid: true,
        verified: true,
        selectedTests: [],
        executedTests: [],
        reusedTests: [],
        skippedTests: [],
        changedFiles: [],
        affectedModules: [],
        passed: 0,
        failed: 0,
        cached: 0,
        escalated: false,
        escalationReasons: [],
        durationMs: 12,
        graphIssues: [],
        evidence: null,
      }),
      'utf8',
    );

    const report = readLatestVerificationReport({ repoRoot: root });
    expect(report?.result).toBe('pass');
    expect(report?.graphValid).toBe(true);
  });

  it('runs the current verification command and parses the returned report', () => {
    const spawn = vi.fn().mockReturnValue({
      status: 0,
      stdout: JSON.stringify({
        version: 1,
        level: 'V1',
        scope: 'affected',
        result: 'pass',
        graphValid: true,
        verified: true,
        selectedTests: ['tests/unit/example.test.ts'],
        executedTests: ['tests/unit/example.test.ts'],
        reusedTests: [],
        skippedTests: [],
        changedFiles: ['src/example.ts'],
        affectedModules: ['example'],
        passed: 1,
        failed: 0,
        cached: 0,
        escalated: false,
        escalationReasons: [],
        durationMs: 42,
        graphIssues: [],
        evidence: 'sha256:abc',
        reportPath: '/tmp/latest.json',
        fingerprint: 'sha256:def',
      }),
      stderr: '',
    });

    const result = runVerificationCommand({ repoRoot: '/repo', scope: 'affected', noCache: true }, { spawn });
    expect(result.ok).toBe(true);
    expect(spawn).toHaveBeenCalledWith(
      'pnpm',
      ['verify', 'affected', '--no-cache', '--json'],
      expect.objectContaining({ cwd: '/repo' }),
    );
    expect(result.report?.result).toBe('pass');
    expect(result.reportPath).toBe('/tmp/latest.json');
    expect(result.fingerprint).toBe('sha256:def');
  });

  it('routes module-targeted verification through module scope', () => {
    const spawn = vi.fn().mockReturnValue({
      status: 0,
      stdout: JSON.stringify({
        version: 1,
        level: 'V2',
        scope: 'module',
        result: 'pass',
        graphValid: true,
        verified: true,
        selectedTests: ['tests/unit/example.test.ts'],
        executedTests: ['tests/unit/example.test.ts'],
        reusedTests: [],
        skippedTests: [],
        changedFiles: ['src/example.ts'],
        affectedModules: ['example'],
        passed: 1,
        failed: 0,
        cached: 0,
        escalated: false,
        escalationReasons: [],
        durationMs: 42,
        graphIssues: [],
        evidence: 'sha256:abc',
        reportPath: '/tmp/latest.json',
        fingerprint: 'sha256:def',
      }),
      stderr: '',
    });

    const result = runVerificationCommand({ repoRoot: '/repo', moduleName: 'example', noCache: true }, { spawn });
    expect(result.ok).toBe(true);
    expect(spawn).toHaveBeenCalledWith(
      'pnpm',
      ['verify', 'module', 'example', '--no-cache', '--json'],
      expect.objectContaining({ cwd: '/repo' }),
    );
    expect(result.report?.scope).toBe('module');
  });
});
