import { conflict, notFound } from '../../core/errors.js';
import type { ComponentCategory, ComponentDefinition } from '../contracts.js';

export interface ComponentRegistryOptions {
  readonly resolveCapability?: (capability: string) => boolean;
}

/**
 * COMP-003 — Component registry. Components come from Vestara Core, installed
 * modules, applications, Marketplace packages, workspace packages and
 * generated components. The Builder asks the registry what exists rather than
 * importing every component itself.
 */
export class ComponentRegistry {
  private readonly components = new Map<string, ComponentDefinition[]>();
  private readonly resolveCapability: (capability: string) => boolean;

  constructor(options: ComponentRegistryOptions = {}) {
    this.resolveCapability = options.resolveCapability ?? (() => true);
  }

  register(definition: ComponentDefinition): void {
    const list = this.components.get(definition.id) ?? [];
    if (list.some((c) => c.version === definition.version)) throw conflict(`Component "${definition.id}@${definition.version}" already registered`);
    list.push(definition);
    this.components.set(definition.id, list);
  }

  resolve(id: string, version?: string): ComponentDefinition {
    const list = this.components.get(id) ?? [];
    if (list.length === 0) throw notFound(`Component "${id}" not found`);
    if (version) {
      const found = list.find((c) => c.version === version);
      if (!found) throw notFound(`Component "${id}@${version}" not found`);
      return found;
    }
    return list.sort((a, b) => b.version.localeCompare(a.version))[0]!;
  }

  has(id: string): boolean {
    return this.components.has(id);
  }

  list(): readonly ComponentDefinition[] {
    return [...this.components.values()].flatMap((list) => list).sort((a, b) => a.id.localeCompare(b.id));
  }

  search(query?: string): readonly ComponentDefinition[] {
    let items = this.list().filter((c) => c.status === 'published' || c.status === 'ready');
    if (query) {
      const needle = query.toLowerCase();
      items = items.filter((c) => c.id.toLowerCase().includes(needle) || c.displayName.toLowerCase().includes(needle) || c.name.toLowerCase().includes(needle));
    }
    return items;
  }

  categories(): readonly { name: ComponentCategory; count: number }[] {
    const counts = new Map<ComponentCategory, number>();
    for (const component of this.list()) {
      counts.set(component.category, (counts.get(component.category) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  }

  versions(id: string): readonly string[] {
    return (this.components.get(id) ?? []).map((c) => c.version).sort();
  }

  listByCategory(category: ComponentCategory): readonly ComponentDefinition[] {
    return this.list().filter((c) => c.category === category);
  }

  /** COMP-011 — capability resolution: component is available only if its required capabilities exist. */
  availability(id: string): { available: boolean; missing: readonly string[] } {
    const definition = this.resolve(id);
    const missing = definition.capabilities.filter((cap) => !this.resolveCapability(cap));
    return { available: missing.length === 0, missing };
  }
}
