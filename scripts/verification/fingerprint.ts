import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT } from './affected.ts';

export const ENGINE_VERSION = '2.0.0-alpha.1';

const ENGINE_DIR = join(REPO_ROOT, 'scripts', 'verification');

/**
 * FASTVERIFY-009: deterministic verification fingerprint.
 *
 * A fingerprint identifies the exact verification scope and its inputs:
 *   - engine version and engine source
 *   - toolchain (node version, platform)
 *   - dependency/config files (package manifests, lockfile, tsconfigs,
 *     vitest config, verification config)
 *   - the source files under verification
 *   - the selected tests
 *   - the level and scope of the run
 *
 * Deterministic by construction: sorted file lists, stable separators, no
 * timestamps. Identical inputs always produce an identical fingerprint.
 */

function readFileSafe(relPath: string): string {
  const full = join(REPO_ROOT, relPath);
  if (!existsSync(full)) return '';
  try {
    return readFileSync(full, 'utf8');
  } catch {
    return '';
  }
}

function engineFileList(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else out.push(full.replace(REPO_ROOT + '/', ''));
    }
  };
  walk(ENGINE_DIR);
  return out.sort();
}

export interface FingerprintOptions {
  level: string;
  scope: string;
  sourceFiles: string[];
  testFiles: string[];
  dependencyFiles: string[];
}

export function computeFingerprint(options: FingerprintOptions): string {
  const material: string[] = [];

  material.push(`engine=${ENGINE_VERSION}`);
  material.push(`node=${process.version}`);
  material.push(`platform=${process.platform}`);
  material.push(`level=${options.level}`);
  material.push(`scope=${options.scope}`);

  for (const file of engineFileList()) {
    const content = readFileSafe(file);
    if (content) material.push(`engine-file ${file}\n${content}`);
  }

  const dependencies = [...options.dependencyFiles].sort();
  for (const file of dependencies) {
    const content = readFileSafe(file);
    if (content) material.push(`dep ${file}\n${content}`);
  }

  const sources = [...options.sourceFiles].sort();
  for (const file of sources) {
    const content = readFileSafe(file);
    if (content) material.push(`src ${file}\n${content}`);
  }

  const tests = [...options.testFiles].sort();
  for (const file of tests) {
    const content = readFileSafe(file);
    if (content) material.push(`test ${file}\n${content}`);
  }

  const hash = createHash('sha256').update(material.join('\n')).digest('hex');
  return `sha256:${hash}`;
}