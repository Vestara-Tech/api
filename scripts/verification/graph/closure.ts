import { matchAnyGlob } from '../glob.ts';

import { resolveModuleId } from './normalize.ts';
import type { ModuleId, ValidatedVerificationGraph } from './types.ts';
import { toModuleId } from './types.ts';

function buildReverseDependencies(graph: ValidatedVerificationGraph): Map<ModuleId, Set<ModuleId>> {
  const reverse = new Map<ModuleId, Set<ModuleId>>();
  for (const [module, dependencies] of graph.dependencies) {
    if (!reverse.has(module)) reverse.set(module, new Set());
    for (const dependency of dependencies) {
      const dependents = reverse.get(dependency) ?? new Set<ModuleId>();
      dependents.add(module);
      reverse.set(dependency, dependents);
    }
  }
  return reverse;
}

export function findOwningModule(graph: ValidatedVerificationGraph, file: string): ModuleId | null {
  for (const [id, module] of [...graph.modules.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (matchAnyGlob(module.sources as string[], file)) return id;
  }
  return null;
}

export function moduleTests(graph: ValidatedVerificationGraph, moduleName: string, knownTests: readonly string[]): string[] {
  const moduleId = resolveModuleId(graph, moduleName);
  if (moduleId === null) return [];
  const module = graph.modules.get(moduleId);
  if (!module) return [];
  return [...knownTests].filter((test) => matchAnyGlob(module.tests as string[], test)).sort();
}

export function dependencyClosure(graph: ValidatedVerificationGraph, seeds: Iterable<ModuleId>): ModuleId[] {
  const reverse = buildReverseDependencies(graph);
  const seedSet = new Set<ModuleId>(seeds);
  const queue = [...seedSet].sort();
  const visited = new Set<ModuleId>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    const dependents = [...(reverse.get(current) ?? new Set<ModuleId>())].sort();
    for (const dependent of dependents) {
      if (seedSet.has(dependent) || visited.has(dependent)) continue;
      visited.add(dependent);
      queue.push(dependent);
    }
  }

  return [...visited].sort((left, right) => left.localeCompare(right));
}

export function ownedDependencies(graph: ValidatedVerificationGraph, moduleName: string): readonly string[] {
  const moduleId = resolveModuleId(graph, moduleName);
  if (moduleId === null) return [];
  return [...(graph.dependencies.get(moduleId) ?? new Set())].map((id) => String(id)).sort();
}

export function canonicalModuleId(value: string): ModuleId {
  return toModuleId(value);
}
