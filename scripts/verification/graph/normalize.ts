import { toModuleId } from './types.ts';
import type {
  GraphIssue,
  ModuleId,
  NormalizedVerificationModule,
  ParsedVerificationGraph,
  ValidatedVerificationGraph,
} from './types.ts';

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

export function resolveModuleId(graph: ValidatedVerificationGraph | null, value: string): ReturnType<typeof toModuleId> | null {
  if (!graph) return null;
  for (const [id, module] of graph.modules) {
    if (module.rawId === value) return id;
  }
  return graph.aliases.get(value) ?? null;
}

export function normalizeVerificationGraph(
  parsed: ParsedVerificationGraph,
  sharedModules: readonly string[] = [],
): { graph: ValidatedVerificationGraph; issues: GraphIssue[] } {
  const issues: GraphIssue[] = [];
  const modulesById = new Map<string, NormalizedVerificationModule>();

  const rawModuleIds = new Set(parsed.modules.map((module) => module.id));
  const sharedTargets = new Set(sharedModules);
  const aliasEntries = [...parsed.aliases.entries()].sort(([left], [right]) => left.localeCompare(right));
  const aliasLookup = new Map<string, string>(aliasEntries);

  const resolveReference = (value: string, trail: Set<string> = new Set()): string | null => {
    if (trail.has(value)) {
      issues.push(
        issue('error', 'VGRAPH_ALIAS_CYCLE', `Alias cycle detected while resolving "${value}".`, { alias: value }),
      );
      return null;
    }

    const target = aliasLookup.get(value);
    if (target === undefined) return rawModuleIds.has(value) ? value : null;

    trail.add(value);
    const resolved = resolveReference(target, trail);
    trail.delete(value);
    return resolved;
  };

  for (const [alias, target] of aliasEntries) {
    if (rawModuleIds.has(alias)) {
      issues.push(
        issue('error', 'VGRAPH_ALIAS_COLLISION', `Alias "${alias}" collides with an existing module id.`, { alias, dependency: target }),
      );
      continue;
    }

    const resolved = resolveReference(target);
    if (resolved === null) {
      issues.push(
        issue('error', 'VGRAPH_ALIAS_TARGET_MISSING', `Alias "${alias}" targets unknown module "${target}".`, {
          alias,
          dependency: target,
        }),
      );
      continue;
    }

    aliasLookup.set(alias, resolved);
  }

  const normalizedModules = [...parsed.modules].sort((left, right) => left.id.localeCompare(right.id));
  for (const raw of normalizedModules) {
    const id = toModuleId(raw.id);
    const resolvedDependsOn: ModuleId[] = [];
    const seenDependencies = new Set<string>();

    for (const dependency of [...raw.dependsOn].sort()) {
      if (sharedTargets.has(dependency)) continue;
      const resolved = resolveReference(dependency);
      if (resolved === null) {
        issues.push(
          issue('error', 'VGRAPH_UNKNOWN_DEPENDENCY', `Module "${raw.id}" depends on unknown module "${dependency}".`, {
            module: raw.id,
            dependency,
          }),
        );
        continue;
      }

      if (resolved === raw.id) {
        issues.push(
          issue('error', 'VGRAPH_SELF_DEPENDENCY', `Module "${raw.id}" cannot depend on itself.`, {
            module: raw.id,
            dependency,
          }),
        );
        continue;
      }

      if (seenDependencies.has(resolved)) continue;
      seenDependencies.add(resolved);
      resolvedDependsOn.push(toModuleId(resolved));
    }

    if (modulesById.has(raw.id)) {
      issues.push(
        issue('error', 'VGRAPH_DUPLICATE_CANONICAL_ID', `Duplicate canonical module id "${raw.id}".`, { module: raw.id }),
      );
      continue;
    }

    modulesById.set(raw.id, {
      id,
      rawId: raw.id,
      sources: [...raw.sources],
      tests: [...raw.tests],
      dependsOn: resolvedDependsOn,
      cwd: raw.cwd,
    });
  }

  const aliases = new Map<string, ReturnType<typeof toModuleId>>();
  for (const [alias, target] of aliasEntries) {
    const resolved = aliasLookup.get(alias);
    if (resolved === undefined) continue;
    aliases.set(alias, toModuleId(resolved));
  }

  const dependencies = new Map<ReturnType<typeof toModuleId>, ReadonlySet<ReturnType<typeof toModuleId>>>();
  for (const module of modulesById.values()) {
    dependencies.set(module.id, new Set(module.dependsOn));
  }

  return {
    graph: {
      modules: new Map([...modulesById.entries()].map(([id, module]) => [toModuleId(id), module] as const)),
      aliases,
      dependencies,
    },
    issues: sortIssues(issues),
  };
}
