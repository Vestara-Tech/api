import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Classification } from './affected.ts';
import { findTestFiles, matchTestsForSource } from './affected.ts';
import { dependencyClosure, findOwningModule, moduleTests } from './graph/index.ts';
import type { ModuleId, ValidatedVerificationGraph } from './graph/index.ts';

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

export function allTests(repoRoot: string): string[] {
  return findTestFiles(repoRoot);
}

function moduleTestsFor(graph: ValidatedVerificationGraph, moduleName: string, knownTests: string[]): string[] {
  return moduleTests(graph, moduleName, knownTests);
}

function collectDirectModules(
  classification: Classification,
  graph: ValidatedVerificationGraph,
  knownTests: readonly string[],
): { direct: ModuleId[]; unknownSources: string[]; sharedImpact: boolean; conventionTests: string[] } {
  const direct = new Set<ModuleId>();
  const unknownSources: string[] = [];
  const conventionTests = new Set<string>();
  let sharedImpact = classification.shared.length > 0;

  const consider = [...classification.sources, ...classification.contracts];
  for (const source of consider) {
    const module = findOwningModule(graph, source);
    if (module) {
      direct.add(module);
      continue;
    }

    const convention = matchTestsForSource(source, knownTests);
    if (convention.length === 0) unknownSources.push(source);
    else for (const test of convention) conventionTests.add(test);
  }

  return {
    direct: [...direct].sort((left, right) => left.localeCompare(right)),
    unknownSources,
    sharedImpact,
    conventionTests: [...conventionTests].sort(),
  };
}

/**
 * FASTVERIFY-008: compute the verification impact of a set of changed files.
 *
 * Pipeline:
 *   pre-classified change set -> validated graph -> dependency closure ->
 *   test selection -> level determination.
 *
 * Unknown impact always escalates; it is never silently skipped.
 */
export function computeImpact(
  changedFiles: readonly string[],
  classification: Classification,
  graph: ValidatedVerificationGraph,
  knownTests: readonly string[],
): VerificationImpact {
  const impact: VerificationImpact = {
    changedFiles: [...changedFiles].sort(),
    directlyAffectedModules: [],
    transitivelyAffectedModules: [],
    selectedTests: [],
    level: 'V1',
    reasons: [],
    contractChanges: [...classification.contracts].sort(),
    unknownSources: [],
    uncoveredModules: [],
    sharedImpact: classification.shared.length > 0,
  };

  const selected = new Set<string>(classification.tests);
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
  if (impact.contractChanges.length > 0 && level === 'V1') {
    level = 'V2';
    reasons.add(`contract changes: ${impact.contractChanges.join(', ')}`);
  } else if (impact.contractChanges.length > 0) {
    reasons.add(`contract changes: ${impact.contractChanges.join(', ')}`);
  }

  // 3. Module mapping for changed sources (including contract files, which
  //    map to the "contracts" module).
  const { direct, unknownSources, sharedImpact, conventionTests } = collectDirectModules(classification, graph, knownTests);
  impact.directlyAffectedModules = direct;
  impact.unknownSources = unknownSources;
  impact.sharedImpact = sharedImpact;
  for (const test of conventionTests) selected.add(test);

  if (sharedImpact && level !== 'V3') {
    level = 'V3';
    if (classification.shared.length > 0) {
      reasons.add(`shared infrastructure source changed: ${classification.shared.join(', ')}`);
    }
  }

  if (unknownSources.length > 0) {
    if (level === 'V1') level = 'V2';
    reasons.add(`unknown impact for changed sources: ${unknownSources.join(', ')}`);
  }

  // 4. Transitive dependency closure: modules that depend on a changed module
  //    may be affected by the change.
  const transitive = dependencyClosure(graph, direct);
  impact.transitivelyAffectedModules = transitive;

  // 5. Select tests: affected modules (direct + transitive) + changed tests.
  const affected = [...direct, ...transitive];
  for (const module of affected) {
    for (const test of moduleTestsFor(graph, module, knownTests)) selected.add(test);
  }

  // 6. Uncovered modules: explicitly mapped but with no resolvable tests.
  impact.uncoveredModules = [...direct].filter((module) => moduleTestsFor(graph, module, knownTests).length === 0).sort();
  if (impact.uncoveredModules.length > 0) {
    reasons.add(`modules without test coverage: ${impact.uncoveredModules.join(', ')}`);
    if (level === 'V1') level = 'V2';
  }

  // 7. Docs-only change: no sources, no tests, no triggers -> V0 static.
  if (
    classification.sources.length === 0 &&
    classification.shared.length === 0 &&
    classification.tests.length === 0 &&
    level === 'V1' &&
    classification.docs.length > 0
  ) {
    level = 'V0';
    reasons.add('docs-only change');
  }

  // 8. No tests selected despite changed sources -> escalate.
  if (classification.sources.length > 0 && selected.size === 0 && level === 'V1') {
    level = 'V2';
    reasons.add('no tests selected for changed sources');
  }

  impact.selectedTests = [...selected].sort();
  impact.level = level;
  impact.reasons = [...reasons];
  return impact;
}
