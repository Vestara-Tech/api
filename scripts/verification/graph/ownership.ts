import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { findContractFiles, findSourceFiles, findTestFiles } from '../affected.ts';
import { matchAnyGlob } from '../glob.ts';
import type { GraphIssue, ModuleId, NormalizedVerificationModule, ValidatedVerificationGraph } from './types.ts';

const WORKSPACE_ROOTS = ['packages', 'vestara-apps'] as const;
const IGNORED_DIRECTORIES = new Set(['dist', 'node_modules', '.turbo', '.vite']);

function walkFiles(repoRoot: string, relDir: string, visit: (file: string) => void): void {
  const dir = join(repoRoot, relDir);
  if (!existsSync(dir)) return;

  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRECTORIES.has(entry)) continue;

    const full = join(dir, entry);
    const entryStat = statSync(full);
    if (entryStat.isDirectory()) {
      walkFiles(repoRoot, join(relDir, entry), visit);
    } else {
      visit(relative(repoRoot, full).split('\\').join('/'));
    }
  }
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function issue(severity: GraphIssue['severity'], code: string, message: string, extra: Omit<GraphIssue, 'severity' | 'code' | 'message'> = {}): GraphIssue {
  return { severity, code, message, ...extra };
}

function sortIssues(issues: readonly GraphIssue[]): GraphIssue[] {
  const severityOrder: Record<GraphIssue['severity'], number> = { error: 0, warning: 1, info: 2 };
  return [...issues].sort((left, right) => {
    const severity = severityOrder[left.severity] - severityOrder[right.severity];
    if (severity !== 0) return severity;
    return (
      (left.module ?? '').localeCompare(right.module ?? '') ||
      (left.alias ?? '').localeCompare(right.alias ?? '') ||
      (left.dependency ?? '').localeCompare(right.dependency ?? '') ||
      (left.path ?? '').localeCompare(right.path ?? '') ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message)
    );
  });
}

function collectWorkspaceRoots(repoRoot: string): string[] {
  const roots: string[] = [];
  for (const root of WORKSPACE_ROOTS) {
    const rootDir = join(repoRoot, root);
    if (!existsSync(rootDir) || !statSync(rootDir).isDirectory()) continue;
    for (const entry of readdirSync(rootDir)) {
      const full = join(rootDir, entry);
      if (!statSync(full).isDirectory()) continue;
      if (existsSync(join(full, 'package.json'))) roots.push(relative(repoRoot, full).split('\\').join('/'));
    }
  }
  return uniqueSorted(roots);
}

function collectWorkspaceFiles(repoRoot: string): string[] {
  const files: string[] = [];
  for (const root of WORKSPACE_ROOTS) {
    walkFiles(repoRoot, root, (file) => {
      if (file.startsWith('packages/') || file.startsWith('vestara-apps/')) files.push(file);
    });
  }
  return uniqueSorted(files);
}

function collectOwners(
  graph: ValidatedVerificationGraph,
  files: readonly string[],
  selector: (module: NormalizedVerificationModule) => readonly string[],
): Map<string, ModuleId[]> {
  const owners = new Map<string, ModuleId[]>();

  for (const [id, module] of [...graph.modules.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const seen = new Set<string>();
    const patterns = selector(module);
    for (const file of [...files].sort((left, right) => left.localeCompare(right))) {
      if (!matchAnyGlob(patterns as string[], file)) continue;
      if (seen.has(file)) continue;
      seen.add(file);
      const list = owners.get(file) ?? [];
      list.push(id);
      owners.set(file, list);
    }
  }

  return owners;
}

function collectModuleFiles(
  graph: ValidatedVerificationGraph,
  files: readonly string[],
  selector: (module: NormalizedVerificationModule) => readonly string[],
): Map<ModuleId, string[]> {
  const byModule = new Map<ModuleId, string[]>();

  for (const [id, module] of [...graph.modules.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const selected = [...files].filter((file) => matchAnyGlob(selector(module) as string[], file)).sort((left, right) => left.localeCompare(right));
    byModule.set(id, selected);
  }

  return byModule;
}

function bucketFromOwners(files: readonly string[], owners: Map<string, ModuleId[]>): OwnershipBucket {
  const normalizedFiles = uniqueSorted(files);
  const byFile = new Map<string, readonly ModuleId[]>();
  const owned: string[] = [];
  const unowned: string[] = [];
  const ambiguous: OwnershipEntry[] = [];

  for (const file of normalizedFiles) {
    const resolvedOwners = uniqueSorted((owners.get(file) ?? []).map(String)).map((owner) => owner as ModuleId);
    byFile.set(file, resolvedOwners);
    if (resolvedOwners.length === 0) {
      unowned.push(file);
    } else if (resolvedOwners.length === 1) {
      owned.push(file);
    } else {
      ambiguous.push({ file, owners: resolvedOwners });
    }
  }

  return { files: normalizedFiles, owned, unowned, ambiguous, byFile };
}

function workspaceCoverage(
  repoRoot: string,
  production: OwnershipBucket,
): WorkspaceCoverage {
  const roots = collectWorkspaceRoots(repoRoot);
  const covered: string[] = [];
  const uncovered: string[] = [];

  for (const root of roots) {
    const rootFiles = production.files.filter((file) => file.startsWith(`${root}/`));
    const fullyOwned = rootFiles.length > 0 && rootFiles.every((file) => (production.byFile.get(file)?.length ?? 0) === 1);
    if (fullyOwned) covered.push(root);
    else uncovered.push(root);
  }

  return {
    roots,
    packages: roots.filter((root) => root.startsWith('packages/')),
    applications: roots.filter((root) => root.startsWith('vestara-apps/')),
    covered,
    uncovered,
    total: roots.length,
    coveredCount: covered.length,
  };
}

export interface OwnershipEntry {
  readonly file: string;
  readonly owners: readonly ModuleId[];
}

export interface OwnershipBucket {
  readonly files: readonly string[];
  readonly owned: readonly string[];
  readonly unowned: readonly string[];
  readonly ambiguous: readonly OwnershipEntry[];
  readonly byFile: ReadonlyMap<string, readonly ModuleId[]>;
}

export interface WorkspaceCoverage {
  readonly roots: readonly string[];
  readonly packages: readonly string[];
  readonly applications: readonly string[];
  readonly covered: readonly string[];
  readonly uncovered: readonly string[];
  readonly total: number;
  readonly coveredCount: number;
}

export interface ModuleOwnership {
  readonly sourceFiles: readonly string[];
  readonly contractFiles: readonly string[];
  readonly testFiles: readonly string[];
}

export interface OwnershipIndex {
  readonly source: OwnershipBucket;
  readonly contracts: OwnershipBucket;
  readonly production: OwnershipBucket;
  readonly tests: OwnershipBucket;
  readonly ignored: readonly string[];
  readonly workspace: WorkspaceCoverage;
  readonly modules: ReadonlyMap<ModuleId, ModuleOwnership>;
}

export type OwnershipMode = 'validator' | 'strict';

export interface OwnershipDiscovery {
  readonly sourceFiles?: readonly string[];
  readonly contractFiles?: readonly string[];
  readonly testFiles?: readonly string[];
}

export function buildOwnershipIndex(
  repoRoot: string,
  graph: ValidatedVerificationGraph,
  discovery: OwnershipDiscovery = {},
): OwnershipIndex {
  const sourceFiles = uniqueSorted(discovery.sourceFiles ?? findSourceFiles(repoRoot));
  const contractFiles = uniqueSorted(discovery.contractFiles ?? findContractFiles(repoRoot));
  const testFiles = uniqueSorted(discovery.testFiles ?? findTestFiles(repoRoot));
  const workspaceFiles = collectWorkspaceFiles(repoRoot);
  const productionFiles = uniqueSorted([...sourceFiles, ...contractFiles]);
  const productionSet = new Set(productionFiles);
  const testSet = new Set(testFiles);
  const ignored = workspaceFiles.filter((file) => !productionSet.has(file) && !testSet.has(file));

  const sourceOwners = collectOwners(graph, sourceFiles, (module) => module.sources);
  const contractOwners = collectOwners(graph, contractFiles, (module) => module.sources);
  const productionOwners = collectOwners(graph, productionFiles, (module) => module.sources);
  const testOwners = collectOwners(graph, testFiles, (module) => module.tests);
  const moduleSourceFiles = collectModuleFiles(graph, sourceFiles, (module) => module.sources);
  const moduleContractFiles = collectModuleFiles(graph, contractFiles, (module) => module.sources);
  const moduleTestFiles = collectModuleFiles(graph, testFiles, (module) => module.tests);
  const productionBucket = bucketFromOwners(productionFiles, productionOwners);

  const modules = new Map<ModuleId, ModuleOwnership>();
  for (const [id, module] of [...graph.modules.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    modules.set(id, {
      sourceFiles: moduleSourceFiles.get(id) ?? [],
      contractFiles: moduleContractFiles.get(id) ?? [],
      testFiles: moduleTestFiles.get(id) ?? [],
    });
  }

  return {
    source: bucketFromOwners(sourceFiles, sourceOwners),
    contracts: bucketFromOwners(contractFiles, contractOwners),
    production: productionBucket,
    tests: bucketFromOwners(testFiles, testOwners),
    ignored,
    workspace: workspaceCoverage(repoRoot, productionBucket),
    modules,
  };
}

function addOwnershipIssue(
  issues: GraphIssue[],
  severity: GraphIssue['severity'],
  code: string,
  message: string,
  extra: Omit<GraphIssue, 'severity' | 'code' | 'message'> = {},
): void {
  issues.push(issue(severity, code, message, extra));
}

export function ownershipIssues(index: OwnershipIndex, mode: OwnershipMode): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const strict = mode === 'strict';

  for (const entry of index.production.ambiguous) {
    addOwnershipIssue(
      issues,
      'error',
      strict ? 'VGRAPH_AMBIGUOUS_PRODUCTION_FILE' : 'VGRAPH_DUPLICATE_SOURCE_OWNERSHIP',
      `Production file "${entry.file}" is owned by multiple modules.`,
      { path: entry.file, module: entry.owners.map(String).sort().join(', ') },
    );
  }

  if (strict) {
    for (const file of index.production.unowned) {
      addOwnershipIssue(issues, 'error', 'VGRAPH_UNOWNED_PRODUCTION_FILE', `Production file "${file}" has no accountable module.`, {
        path: file,
      });
    }

    for (const file of index.tests.unowned) {
      addOwnershipIssue(issues, 'warning', 'VGRAPH_UNOWNED_TEST_FILE', `Test file "${file}" has no accountable module.`, {
        path: file,
      });
    }

    for (const entry of index.tests.ambiguous) {
      addOwnershipIssue(
        issues,
        'warning',
        'VGRAPH_DUPLICATE_TEST_OWNERSHIP',
        `Test file "${entry.file}" is owned by multiple modules.`,
        { path: entry.file, module: entry.owners.map(String).sort().join(', ') },
      );
    }

    for (const root of index.workspace.uncovered) {
      addOwnershipIssue(issues, 'error', 'VGRAPH_WORKSPACE_ROOT_UNMAPPED', `Workspace root "${root}" is not fully covered by owned production files.`, {
        path: root,
      });
    }
  } else {
    for (const entry of index.tests.ambiguous) {
      addOwnershipIssue(
        issues,
        'warning',
        'VGRAPH_DUPLICATE_TEST_OWNERSHIP',
        `Test file "${entry.file}" is owned by multiple modules.`,
        { path: entry.file, module: entry.owners.map(String).sort().join(', ') },
      );
    }

    for (const root of index.workspace.uncovered) {
      addOwnershipIssue(issues, 'warning', 'VGRAPH_WORKSPACE_ROOT_UNMAPPED', `Workspace root "${root}" is not covered by any verification module.`, {
        path: root,
      });
    }
  }

  for (const [moduleId, module] of [...index.modules.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const productionFiles = [...module.sourceFiles, ...module.contractFiles];
    if (productionFiles.length === 0) {
      if (module.testFiles.length > 0) {
        addOwnershipIssue(
          issues,
          'warning',
          'VGRAPH_ORPHAN_TEST_MODULE',
          `Module "${String(moduleId)}" only owns tests and no source files.`,
          { module: String(moduleId) },
        );
      } else {
        addOwnershipIssue(
          issues,
          'warning',
          'VGRAPH_SOURCE_COVERAGE_GAP',
          `Module "${String(moduleId)}" currently matches no source files.`,
          { module: String(moduleId) },
        );
      }
      continue;
    }

    if (module.testFiles.length === 0) {
      addOwnershipIssue(
        issues,
        'error',
        'VGRAPH_MISSING_TEST_COVERAGE',
        `Module "${String(moduleId)}" has source coverage but no matching tests.`,
        { module: String(moduleId) },
      );
    }
  }

  return sortIssues(issues);
}
