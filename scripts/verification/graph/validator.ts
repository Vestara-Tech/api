import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

import { findSourceFiles, findTestFiles } from '../affected.ts';
import { matchAnyGlob } from '../glob.ts';
import type { VerificationConfig } from '../affected.ts';
import type { GraphBuildResult, GraphIssue, ModuleId, NormalizedVerificationModule, ValidatedVerificationGraph } from './types.ts';
import { normalizeVerificationGraph } from './normalize.ts';
import { parseVerificationGraph } from './parser.ts';

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

function validatePatternList(
  module: NormalizedVerificationModule,
  kind: 'source' | 'test',
  patterns: readonly string[],
  issues: GraphIssue[],
): void {
  if (patterns.length === 0) {
    issues.push(
      issue('error', kind === 'source' ? 'VGRAPH_EMPTY_SOURCE_GLOBS' : 'VGRAPH_EMPTY_TEST_GLOBS', `Module "${module.rawId}" has no ${kind} globs.`, {
        module: module.rawId,
      }),
    );
  }

  for (const pattern of patterns) {
    if (typeof pattern !== 'string' || pattern.trim().length === 0) {
      issues.push(
        issue('error', 'VGRAPH_MALFORMED_GLOB', `Module "${module.rawId}" contains an empty ${kind} glob.`, {
          module: module.rawId,
          path: String(pattern),
        }),
      );
      continue;
    }
    if (pattern.includes('\0')) {
      issues.push(
        issue('error', 'VGRAPH_MALFORMED_GLOB', `Module "${module.rawId}" contains an invalid ${kind} glob.`, {
          module: module.rawId,
          path: pattern,
        }),
      );
    }
  }
}

function validateCwd(repoRoot: string, module: NormalizedVerificationModule, issues: GraphIssue[]): void {
  if (module.cwd === undefined) return;
  if (module.cwd.trim().length === 0) {
    issues.push(issue('error', 'VGRAPH_INVALID_CWD', `Module "${module.rawId}" has an empty cwd.`, { module: module.rawId }));
    return;
  }

  const cwd = module.cwd.replace(/\\/g, '/');
  const resolved = resolve(repoRoot, cwd);
  const rel = relative(repoRoot, resolved).replace(/\\/g, '/');
  if (rel.startsWith('..') || rel === '' && cwd.startsWith('..')) {
    issues.push(
      issue('error', 'VGRAPH_INVALID_CWD', `Module "${module.rawId}" cwd points outside the repository root.`, {
        module: module.rawId,
        path: module.cwd,
      }),
    );
    return;
  }

  if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
    issues.push(
      issue('error', 'VGRAPH_INVALID_CWD', `Module "${module.rawId}" cwd does not exist or is not a directory.`, {
        module: module.rawId,
        path: module.cwd,
      }),
    );
  }
}

function collectOwnership(
  modules: readonly NormalizedVerificationModule[],
  files: readonly string[],
): Map<string, ModuleId[]> {
  const owners = new Map<string, ModuleId[]>();
  for (const module of modules) {
    const seen = new Set<string>();
    for (const file of files) {
      if (!matchAnyGlob(module.sources as string[], file)) continue;
      if (seen.has(file)) continue;
      seen.add(file);
      const list = owners.get(file) ?? [];
      list.push(module.id);
      owners.set(file, list);
    }
  }
  return owners;
}

function validateOwnership(
  modules: readonly NormalizedVerificationModule[],
  sourceFiles: readonly string[],
  testFiles: readonly string[],
  issues: GraphIssue[],
): void {
  const sourceOwners = collectOwnership(modules, sourceFiles);
  const testOwners = new Map<string, ModuleId[]>();

  for (const module of modules) {
    const seen = new Set<string>();
    for (const file of testFiles) {
      if (!matchAnyGlob(module.tests as string[], file)) continue;
      if (seen.has(file)) continue;
      seen.add(file);
      const list = testOwners.get(file) ?? [];
      list.push(module.id);
      testOwners.set(file, list);
    }
  }

  for (const [file, owners] of [...sourceOwners.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (owners.length > 1) {
      issues.push(
        issue('error', 'VGRAPH_DUPLICATE_SOURCE_OWNERSHIP', `Source file "${file}" is owned by multiple modules.`, {
          path: file,
          module: owners.map(String).sort().join(', '),
        }),
      );
    }
  }

  for (const [file, owners] of [...testOwners.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (owners.length > 1) {
      issues.push(
        issue('warning', 'VGRAPH_DUPLICATE_TEST_OWNERSHIP', `Test file "${file}" is owned by multiple modules.`, {
          path: file,
          module: owners.map(String).sort().join(', '),
        }),
      );
    }
  }

  for (const module of modules) {
    const matchedSources = sourceFiles.filter((file) => matchAnyGlob(module.sources as string[], file));
    const matchedTests = testFiles.filter((file) => matchAnyGlob(module.tests as string[], file));

    if (matchedSources.length === 0) {
      issues.push(
        issue('warning', 'VGRAPH_SOURCE_COVERAGE_GAP', `Module "${module.rawId}" currently matches no source files.`, {
          module: module.rawId,
        }),
      );
    }

    if (matchedSources.length > 0 && matchedTests.length === 0) {
      issues.push(
        issue('error', 'VGRAPH_MISSING_TEST_COVERAGE', `Module "${module.rawId}" has source coverage but no matching tests.`, {
          module: module.rawId,
        }),
      );
    } else if (matchedSources.length === 0 && matchedTests.length > 0) {
      issues.push(
        issue('warning', 'VGRAPH_ORPHAN_TEST_MODULE', `Module "${module.rawId}" only owns tests and no source files.`, {
          module: module.rawId,
        }),
      );
    }
  }
}

function validateWorkspaceCoverage(
  repoRoot: string,
  modules: readonly NormalizedVerificationModule[],
  sourceFiles: readonly string[],
  issues: GraphIssue[],
): void {
  const roots = ['packages', 'vestara-apps'];
  const workspaceRoots: string[] = [];

  for (const root of roots) {
    const rootDir = join(repoRoot, root);
    if (!existsSync(rootDir) || !statSync(rootDir).isDirectory()) continue;
    for (const entry of readdirSync(rootDir)) {
      const full = join(rootDir, entry);
      if (!statSync(full).isDirectory()) continue;
      const packageJson = join(full, 'package.json');
      if (existsSync(packageJson)) workspaceRoots.push(relative(repoRoot, full).replace(/\\/g, '/'));
    }
  }

  const sourceCoverage = new Map<string, boolean>();
  for (const workspaceRoot of workspaceRoots.sort()) {
    const hasCoverage = modules.some((module) =>
      sourceFiles.some((file) => file.startsWith(`${workspaceRoot}/`) && matchAnyGlob(module.sources as string[], file)),
    );
    sourceCoverage.set(workspaceRoot, hasCoverage);
  }

  for (const [workspaceRoot, covered] of [...sourceCoverage.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (!covered) {
      issues.push(
        issue('warning', 'VGRAPH_WORKSPACE_ROOT_UNMAPPED', `Workspace root "${workspaceRoot}" is not covered by any verification module.`, {
          path: workspaceRoot,
        }),
      );
    }
  }
}

function validateDependencyCycles(graph: ValidatedVerificationGraph, issues: GraphIssue[]): void {
  const visiting = new Set<ModuleId>();
  const visited = new Set<ModuleId>();
  const stack: ModuleId[] = [];

  const visit = (module: ModuleId): void => {
    if (visited.has(module)) return;
    if (visiting.has(module)) {
      const start = stack.indexOf(module);
      const cycle = start >= 0 ? [...stack.slice(start), module].map(String).join(' -> ') : String(module);
      issues.push(issue('error', 'VGRAPH_DEPENDENCY_CYCLE', `Dependency cycle detected: ${cycle}.`, { module: String(module) }));
      return;
    }

    visiting.add(module);
    stack.push(module);
    const dependencies = [...(graph.dependencies.get(module) ?? new Set<ModuleId>())].sort((left, right) => left.localeCompare(right));
    for (const dependency of dependencies) visit(dependency);
    stack.pop();
    visiting.delete(module);
    visited.add(module);
  };

  for (const module of [...graph.modules.keys()].sort((left, right) => left.localeCompare(right))) {
    visit(module);
  }
}

export function validateVerificationGraph(repoRoot: string, graph: ValidatedVerificationGraph): GraphBuildResult {
  const sourceFiles = findSourceFiles(repoRoot);
  const testFiles = findTestFiles(repoRoot);
  const issues: GraphIssue[] = [];

  for (const module of [...graph.modules.values()].sort((left, right) => left.rawId.localeCompare(right.rawId))) {
    validatePatternList(module, 'source', module.sources, issues);
    validatePatternList(module, 'test', module.tests, issues);
    validateCwd(repoRoot, module, issues);
  }

  validateOwnership([...graph.modules.values()], sourceFiles, testFiles, issues);
  validateWorkspaceCoverage(repoRoot, [...graph.modules.values()], sourceFiles, issues);
  validateDependencyCycles(graph, issues);

  const normalized = sortIssues(issues);
  const valid = normalized.every((issue) => issue.severity !== 'error');
  return { graph: valid ? graph : null, issues: normalized, valid };
}

export function buildVerificationGraph(repoRoot: string, config: VerificationConfig): GraphBuildResult {
  const parsed = parseVerificationGraph(config);
  const normalized = normalizeVerificationGraph(parsed, config.sharedModules);
  const validation = validateVerificationGraph(repoRoot, normalized.graph);
  const issues = sortIssues([...normalized.issues, ...validation.issues]);
  const valid = issues.every((issue) => issue.severity !== 'error');
  return { graph: valid ? normalized.graph : null, issues, valid };
}
