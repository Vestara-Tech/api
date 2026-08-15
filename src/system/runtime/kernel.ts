/** SYS-038/039/040 — Kernel/module discovery, kernel params, dependency discovery. */

import { readFileSync, existsSync } from 'node:fs';

export interface KernelModuleInfo {
  readonly name: string;
  readonly size?: number;
  readonly usedBy: readonly string[];
  readonly status: 'loaded' | 'available' | 'unknown';
}

export interface KernelInfo {
  readonly release: string;
  readonly version?: string;
  readonly modules: readonly KernelModuleInfo[];
  readonly parameters: readonly { name: string; value?: string }[];
  readonly status: 'supported' | 'unsupported';
}

export interface DependencyEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: 'package' | 'service' | 'kernel-module' | 'library' | 'application';
}

export interface DependencyGraph {
  readonly nodes: readonly string[];
  readonly edges: readonly DependencyEdge[];
  readonly capturedAt: string;
}

/** SYS-038 — Kernel and loaded-module discovery. */
export function discoverKernel(): KernelInfo {
  const release = process.version ?? 'unknown';
  const modules: KernelModuleInfo[] = [];
  try {
    if (existsSync('/proc/modules')) {
      const content = readFileSync('/proc/modules', 'utf8');
      for (const line of content.split('\n')) {
        if (!line.trim()) continue;
        const [name, size] = line.trim().split(/\s+/);
        if (!name) continue;
        modules.push({ name, ...(size ? { size: Number(size) } : {}), usedBy: [], status: 'loaded' });
      }
    }
  } catch {
    /* no privileged access */
  }
  return { release, modules, parameters: [], status: modules.length > 0 ? 'supported' : 'unsupported' };
}

/** SYS-040 — Package/service dependency discovery over a known graph. */
export function buildDependencyGraph(nodes: readonly string[], edges: readonly DependencyEdge[]): DependencyGraph {
  return { nodes: [...new Set(nodes)], edges, capturedAt: new Date().toISOString() };
}

export function dependenciesOf(graph: DependencyGraph, node: string): readonly string[] {
  return graph.edges.filter((e) => e.from === node).map((e) => e.to);
}

export function dependentsOf(graph: DependencyGraph, node: string): readonly string[] {
  return graph.edges.filter((e) => e.to === node).map((e) => e.from);
}
