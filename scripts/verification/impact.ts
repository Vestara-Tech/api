import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  classifyFiles,
  findTestFiles,
  matchTestsForSource,
  type VerificationConfig,
} from './affected.ts';
import { matchAnyGlob } from './glob.ts';

export type ImpactLevel = 'V0' | 'V1' | 'V2' | 'V3';

export interface VerificationImpact {
  changedFiles: string[];
  directlyAffectedModules: string[];
  transitivelyAffectedModules: string[];
  selectedTests: string[];
  level: ImpactLevel;
  reasons: string[];
  contractChanges: string[];
  unknownSources: string[];
  uncoveredModules: string[];
  sharedImpact: boolean;
}

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT_DIR = resolve(SCRIPT_DIR, '..', '..');

/**
 * Map a changed source file to a module by explicit glob match. Returns the
 * module name, or null when the explicit map has no entry (convention-based
 * fallback is handled by the caller in computeImpact).
 */
export function moduleForSource(source: string, config: VerificationConfig): string | null {
  for (const [name, def] of Object.entries(config.modules)) {
    if (matchAnyGlob(def.sources, source)) return name;
  }
  return null;
}

/** Resolve a module's test globs to concrete existing test files. */
export function moduleTests(moduleName: string, config: VerificationConfig, knownTests: string[]): string[] {
  const def = config.modules[moduleName];
  if (!def) return [];
  return knownTests.filter((test) => matchAnyGlob(def.tests, test));
}

export function allTests(repoRoot: string): string[] {
  return findTestFiles(repoRoot);
}

export function isContractChange(file: string, config: VerificationConfig): boolean {
  return matchAnyGlob(config.contractPatterns, file);
}

export function isSharedSource(file: string, config: VerificationConfig): boolean {
  if (!file.startsWith('src/')) return false;
  const segments = file.split('/');
  if (segments.length < 2) return false;
  const top = segments[1]!;
  return config.sharedModules.includes(top);
}

/**
 * FASTVERIFY-008: compute the verification impact of a set of changed files.
 *
 * Pipeline:
 *   explicit module map -> transitive dependency closure -> contract/shared
 *   classification -> test selection -> level determination.
 *
 * Unknown impact always escalates; it is never silently skipped.
 */
export function computeImpact(
  repoRoot: string,
  changed: string[],
  config: VerificationConfig,
): VerificationImpact {
  const classification = classifyFiles(changed, config);
  const knownTests = findTestFiles(repoRoot);

  const impact: VerificationImpact = {
    changedFiles: changed,
    directlyAffectedModules: [],
    transitivelyAffectedModules: [],
    selectedTests: [],
    level: 'V1',
    reasons: [],
    contractChanges: [],
    unknownSources: [],
    uncoveredModules: [],
    sharedImpact: false,
  };

  const selected = new Set<string>(classification.tests);
  const direct = new Set<string>();
  const transitive = new Set<string>();
  const reasons = new Set<string>();
  let level: ImpactLevel = 'V1';

  // 1. Hard escalations: triggers, tooling, unclassifiable files -> V3.
  if (classification.triggers.length > 0) {
    level = 'V3';
    reasons.add(`verification trigger changed: ${classification.triggers.join(', ')}`);
  }
  if (classification.tooling.length > 0) {
    level = 'V3';
    reasons.add(`verification tooling changed: ${classification.tooling.join(', ')}`);
  }
  if (classification.other.length > 0) {
    level = 'V3';
    reasons.add(`unclassifiable changed files: ${classification.other.join(', ')}`);
  }

  // 2. Contract changes (routes, schemas, types, contracts/).
  for (const file of changed) {
    if (isContractChange(file, config)) impact.contractChanges.push(file);
  }
  if (impact.contractChanges.length > 0) {
    if (level === 'V1') level = 'V2';
    reasons.add(`contract changes: ${impact.contractChanges.join(', ')}`);
  }

  // 3. Module mapping for changed sources (including contract files, which
  //    map to the "contracts" module).
  for (const source of [...classification.sources, ...classification.contracts]) {
    if (isSharedSource(source, config)) {
      impact.sharedImpact = true;
      reasons.add(`shared infrastructure source changed: ${source}`);
      continue;
    }
    const module = moduleForSource(source, config);
    if (module) {
      direct.add(module);
    } else {
      // Convention fallback already inside moduleForSource; a null here means
      // no module and no convention coverage.
      const convention = matchTestsForSource(source, knownTests);
      if (convention.length === 0) {
        impact.unknownSources.push(source);
      } else {
        for (const test of convention) selected.add(test);
      }
    }
  }

  // 4. Transitive dependency closure: modules that depend on a changed module
  //    may be affected by the change.
  for (const module of direct) {
    for (const [name, def] of Object.entries(config.modules)) {
      if (def.dependsOn?.includes(module)) transitive.add(name);
    }
  }

  // 5. Shared infrastructure impact -> V3 (repository-wide blast radius).
  if (impact.sharedImpact && level !== 'V3') level = 'V3';

  // 6. Unknown impact -> escalate; never skip silently.
  if (impact.unknownSources.length > 0) {
    if (level === 'V1') level = 'V2';
    reasons.add(`unknown impact for changed sources: ${impact.unknownSources.join(', ')}`);
  }

  // 7. Select tests: affected modules (direct + transitive) + changed tests.
  const affected = [...direct, ...transitive];
  for (const module of affected) {
    for (const test of moduleTests(module, config, knownTests)) selected.add(test);
  }
  impact.directlyAffectedModules = [...direct].sort();
  impact.transitivelyAffectedModules = [...transitive].sort();

  // 8. Uncovered modules: explicitly mapped but with no resolvable tests.
  impact.uncoveredModules = [...direct].filter((module) => moduleTests(module, config, knownTests).length === 0).sort();
  if (impact.uncoveredModules.length > 0) {
    reasons.add(`modules without test coverage: ${impact.uncoveredModules.join(', ')}`);
    if (level === 'V1') level = 'V2';
  }

  // 9. Docs-only change: no sources, no tests, no triggers -> V0 static.
  if (
    classification.sources.length === 0 &&
    classification.tests.length === 0 &&
    level === 'V1' &&
    classification.docs.length > 0
  ) {
    level = 'V0';
    reasons.add('docs-only change');
  }

  // 10. No tests selected despite changed sources -> escalate.
  if (
    classification.sources.length > 0 &&
    selected.size === 0 &&
    level === 'V1' &&
    config.escalateOnUnknownImpact
  ) {
    level = 'V2';
    reasons.add('no tests selected for changed sources');
  }

  impact.selectedTests = [...selected].sort();
  impact.level = level;
  impact.reasons = [...reasons];
  return impact;
}