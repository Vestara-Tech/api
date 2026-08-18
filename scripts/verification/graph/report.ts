import { findContractFiles, findSourceFiles, findTestFiles, type VerificationConfig } from '../affected.ts';
import { dependencyClosure } from './closure.ts';
import { buildOwnershipIndex, ownershipIssues } from './ownership.ts';
import { normalizeVerificationGraph } from './normalize.ts';
import { parseVerificationGraph } from './parser.ts';
import { validateVerificationGraph } from './validator.ts';
import type { GraphIssue, ValidatedVerificationGraph } from './types.ts';

function issueSort(issues: readonly GraphIssue[]): GraphIssue[] {
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

function formatIssue(issue: GraphIssue): string {
  const details = [
    issue.module ? `module=${issue.module}` : null,
    issue.dependency ? `dependency=${issue.dependency}` : null,
    issue.alias ? `alias=${issue.alias}` : null,
    issue.path ? `path=${issue.path}` : null,
  ]
    .filter(Boolean)
    .join(' ');
  return details.length > 0 ? `[${issue.severity.toUpperCase()}] ${issue.code}: ${issue.message} (${details})` : `[${issue.severity.toUpperCase()}] ${issue.code}: ${issue.message}`;
}

function countDependencies(graph: ValidatedVerificationGraph): number {
  let count = 0;
  for (const dependencies of graph.dependencies.values()) count += dependencies.size;
  return count;
}

function printCount(label: string, value: number | string): void {
  console.log(`${label.padEnd(16)} ${value}`);
}

function truncateList(items: readonly string[], limit = 24): string[] {
  if (items.length <= limit) return [...items];
  return [...items.slice(0, limit), `... +${items.length - limit} more`];
}

export interface GraphModuleReport {
  readonly id: string;
  readonly rawId: string;
  readonly dependencies: readonly string[];
  readonly closure: readonly string[];
}

export interface GraphReport {
  readonly version: 1;
  readonly status: 'VALID' | 'INVALID';
  readonly result: 'PASS' | 'FAIL';
  readonly graph: {
    readonly modules: number;
    readonly dependencies: number;
    readonly aliases: number;
    readonly moduleDetails: readonly GraphModuleReport[];
    readonly closure: {
      readonly reachable: number;
      readonly max: number;
    };
  };
  readonly ownership: {
    readonly production: {
      readonly total: number;
      readonly owned: number;
      readonly unowned: number;
      readonly ambiguous: number;
      readonly ignored: number;
      readonly unownedPaths: readonly string[];
      readonly ambiguousPaths: readonly { file: string; owners: readonly string[] }[];
    };
    readonly tests: {
      readonly total: number;
      readonly owned: number;
      readonly unowned: number;
      readonly ambiguous: number;
      readonly unownedPaths: readonly string[];
      readonly ambiguousPaths: readonly { file: string; owners: readonly string[] }[];
    };
    readonly workspace: {
      readonly packages: number;
      readonly applications: number;
      readonly total: number;
      readonly covered: number;
      readonly uncovered: number;
      readonly roots: readonly string[];
      readonly coveredRoots: readonly string[];
      readonly uncoveredRoots: readonly string[];
    };
  };
  readonly warnings: number;
  readonly errors: number;
  readonly issues: readonly GraphIssue[];
}

export function buildGraphReport(repoRoot: string, config: VerificationConfig): GraphReport {
  const parsed = parseVerificationGraph(config);
  const normalized = normalizeVerificationGraph(parsed, config.sharedModules);
  const graph = normalized.graph;
  const validation = validateVerificationGraph(repoRoot, graph);
  const sourceFiles = findSourceFiles(repoRoot);
  const contractFiles = findContractFiles(repoRoot);
  const testFiles = findTestFiles(repoRoot);
  const ownership = buildOwnershipIndex(repoRoot, graph, { sourceFiles, contractFiles, testFiles });
  const graphIssues = [...normalized.issues, ...validation.issues];
  const strictOwnershipIssues = ownershipIssues(ownership, 'strict');
  const issues = issueSort([...graphIssues, ...strictOwnershipIssues]);
  const warnings = issues.filter((issue) => issue.severity === 'warning').length;
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const moduleDetails = [...graph.modules.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, module]) => ({
      id: String(id),
      rawId: module.rawId,
      dependencies: [...(graph.dependencies.get(id) ?? new Set())].map(String).sort((left, right) => left.localeCompare(right)),
      closure: dependencyClosure(graph, [id]).map(String),
    }));
  const closureSizes = moduleDetails.map((module) => module.closure.length);

  return {
    version: 1,
    status: validation.valid ? 'VALID' : 'INVALID',
    result: errors === 0 ? 'PASS' : 'FAIL',
    graph: {
      modules: graph.modules.size,
      dependencies: countDependencies(graph),
      aliases: graph.aliases.size,
      moduleDetails,
      closure: {
        reachable: closureSizes.reduce((total, size) => total + size, 0),
        max: closureSizes.length > 0 ? Math.max(...closureSizes) : 0,
      },
    },
    ownership: {
      production: {
        total: ownership.production.files.length,
        owned: ownership.production.owned.length,
        unowned: ownership.production.unowned.length,
        ambiguous: ownership.production.ambiguous.length,
        ignored: ownership.ignored.length,
        unownedPaths: ownership.production.unowned,
        ambiguousPaths: ownership.production.ambiguous.map((entry) => ({
          file: entry.file,
          owners: [...entry.owners].map(String).sort((left, right) => left.localeCompare(right)),
        })),
      },
      tests: {
        total: ownership.tests.files.length,
        owned: ownership.tests.owned.length,
        unowned: ownership.tests.unowned.length,
        ambiguous: ownership.tests.ambiguous.length,
        unownedPaths: ownership.tests.unowned,
        ambiguousPaths: ownership.tests.ambiguous.map((entry) => ({
          file: entry.file,
          owners: [...entry.owners].map(String).sort((left, right) => left.localeCompare(right)),
        })),
      },
      workspace: {
        packages: ownership.workspace.packages.length,
        applications: ownership.workspace.applications.length,
        total: ownership.workspace.total,
        covered: ownership.workspace.coveredCount,
        uncovered: ownership.workspace.uncovered.length,
        roots: ownership.workspace.roots,
        coveredRoots: ownership.workspace.covered,
        uncoveredRoots: ownership.workspace.uncovered,
      },
    },
    warnings,
    errors,
    issues,
  };
}

export function printGraphReport(report: GraphReport): void {
  console.log('\nVestara Verification Graph');
  console.log('');
  printCount('Status', report.status);
  printCount('Modules', report.graph.modules);
  printCount('Dependencies', report.graph.dependencies);
  printCount('Aliases', report.graph.aliases);
  console.log('');

  console.log('Closure');
  printCount('Reachable', report.graph.closure.reachable);
  printCount('Max downstream', report.graph.closure.max);
  console.log('');

  console.log('Ownership');
  printCount('Production', report.ownership.production.total);
  printCount('Owned', report.ownership.production.owned);
  printCount('Unowned', report.ownership.production.unowned);
  printCount('Ambiguous', report.ownership.production.ambiguous);
  printCount('Ignored', report.ownership.production.ignored);
  console.log('');

  console.log('Tests');
  printCount('Discovered', report.ownership.tests.total);
  printCount('Owned', report.ownership.tests.owned);
  printCount('Unowned', report.ownership.tests.unowned);
  console.log('');

  console.log('Workspace');
  printCount('Packages', report.ownership.workspace.packages);
  printCount('Applications', report.ownership.workspace.applications);
  printCount('Covered', `${report.ownership.workspace.covered}/${report.ownership.workspace.total}`);
  console.log('');

  printCount('Warnings', report.warnings);
  printCount('Errors', report.errors);
  console.log('');
  printCount('Graph', report.result);

  if (report.issues.length > 0) {
    console.log('');
    console.log('Issues');
    for (const line of truncateList(report.issues.map(formatIssue))) console.log(`  ${line}`);
  }
  console.log('');
}
