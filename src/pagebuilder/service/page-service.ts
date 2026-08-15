import { conflict, notFound } from '../../core/errors.js';
import { randomId } from '../../core/identifiers.js';
import type { PageDefinition } from '../domain/page-definition.js';
import { bumpPageRevision } from '../domain/page-validator.js';

export interface PageRegistryPort {
  save(page: PageDefinition): void;
  get(id: string): PageDefinition | undefined;
  list(): readonly PageDefinition[];
  remove(id: string): void;
}

export class InMemoryPageRegistry implements PageRegistryPort {
  private readonly pages = new Map<string, PageDefinition>();

  save(page: PageDefinition): void {
    this.pages.set(page.id, page);
  }

  get(id: string): PageDefinition | undefined {
    return this.pages.get(id);
  }

  list(): readonly PageDefinition[] {
    return [...this.pages.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  remove(id: string): void {
    this.pages.delete(id);
  }
}

export interface PageServiceOptions {
  readonly registry?: PageRegistryPort;
  readonly componentResolver?: { has: (id: string) => boolean };
}

/**
 * PAGE — Page service. Owns the declarative page registry: create, update
 * (revisioned), get, list, delete. Pages reference the Component Module via
 * the resolver; the service itself never imports component internals.
 */
export class PageService {
  private readonly registry: PageRegistryPort;
  private readonly componentResolver: { has: (id: string) => boolean };

  constructor(options: PageServiceOptions = {}) {
    this.registry = options.registry ?? new InMemoryPageRegistry();
    this.componentResolver = options.componentResolver ?? { has: () => true };
  }

  create(input: Omit<PageDefinition, 'revision' | 'updatedAt'>): PageDefinition {
    const page: PageDefinition = { ...input, revision: 1, updatedAt: new Date().toISOString() };
    if (this.registry.get(page.id)) throw conflict(`Page "${page.id}" already exists`);
    this.registry.save(page);
    return page;
  }

  update(id: string, patch: Partial<Omit<PageDefinition, 'id' | 'revision'>>): PageDefinition {
    const current = this.registry.get(id);
    if (!current) throw notFound(`Page "${id}" not found`);
    const next = bumpPageRevision({ ...current, ...patch, id: current.id });
    this.registry.save(next);
    return next;
  }

  get(id: string): PageDefinition {
    const page = this.registry.get(id);
    if (!page) throw notFound(`Page "${id}" not found`);
    return page;
  }

  list(): readonly PageDefinition[] {
    return this.registry.list();
  }

  remove(id: string): void {
    if (!this.registry.get(id)) throw notFound(`Page "${id}" not found`);
    this.registry.remove(id);
  }

  nextId(prefix = 'page'): string {
    return randomId(prefix);
  }

  hasComponent(id: string): boolean {
    return this.componentResolver.has(id);
  }
}
