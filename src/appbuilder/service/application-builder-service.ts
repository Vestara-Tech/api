import { conflict, notFound } from '../../core/errors.js';
import { randomId } from '../../core/identifiers.js';
import type { ApplicationDefinition, ApplicationLifecycleState, ApplicationModel } from '../domain/application-definition.js';
import { canTransition, validateApplication } from '../domain/application-definition.js';
import type { PageDefinition } from '../../pagebuilder/domain/page-definition.js';

export interface PageLookupPort {
  get(id: string): PageDefinition | undefined;
  list(): readonly PageDefinition[];
}

export interface ApplicationStorePort {
  save(app: ApplicationDefinition): void;
  get(id: string): ApplicationDefinition | undefined;
  list(): readonly ApplicationDefinition[];
  remove(id: string): void;
}

export class InMemoryApplicationStore implements ApplicationStorePort {
  private readonly apps = new Map<string, ApplicationDefinition>();

  save(app: ApplicationDefinition): void {
    this.apps.set(app.id, app);
  }

  get(id: string): ApplicationDefinition | undefined {
    return this.apps.get(id);
  }

  list(): readonly ApplicationDefinition[] {
    return [...this.apps.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  remove(id: string): void {
    this.apps.delete(id);
  }
}

export interface ApplicationBuilderOptions {
  readonly store?: ApplicationStorePort;
  readonly pages?: PageLookupPort;
}

/**
 * APP — Application Builder service. Operates one abstraction above pages:
 * applications compose pages + routes + navigation + APIs + auth + workflows.
 * The declarative definition — not generated React — is the source of truth.
 */
export class ApplicationBuilderService {
  private readonly store: ApplicationStorePort;
  private readonly pages: PageLookupPort;

  constructor(options: ApplicationBuilderOptions = {}) {
    this.store = options.store ?? new InMemoryApplicationStore();
    this.pages = options.pages ?? { get: () => undefined, list: () => [] };
  }

  create(input: Omit<ApplicationDefinition, 'lifecycle' | 'revision' | 'updatedAt'>): ApplicationDefinition {
    const errors = validateApplication({ ...input, lifecycle: 'draft', revision: 1, updatedAt: new Date().toISOString() });
    if (errors.length > 0) throw conflict(`Invalid application: ${errors.join('; ')}`);
    const app: ApplicationDefinition = { ...input, lifecycle: 'draft', revision: 1, updatedAt: new Date().toISOString() };
    this.store.save(app);
    return app;
  }

  update(id: string, patch: Partial<Omit<ApplicationDefinition, 'id' | 'revision'>>): ApplicationDefinition {
    const current = this.store.get(id);
    if (!current) throw notFound(`Application "${id}" not found`);
    const next: ApplicationDefinition = { ...current, ...patch, id: current.id, revision: current.revision + 1, updatedAt: new Date().toISOString() };
    const errors = validateApplication(next);
    if (errors.length > 0) throw conflict(`Invalid application: ${errors.join('; ')}`);
    this.store.save(next);
    return next;
  }

  get(id: string): ApplicationDefinition {
    const app = this.store.get(id);
    if (!app) throw notFound(`Application "${id}" not found`);
    return app;
  }

  list(): readonly ApplicationDefinition[] {
    return this.store.list();
  }

  remove(id: string): void {
    if (!this.store.get(id)) throw notFound(`Application "${id}" not found`);
    this.store.remove(id);
  }

  transition(id: string, to: ApplicationLifecycleState): ApplicationDefinition {
    const app = this.get(id);
    if (!canTransition(app.lifecycle, to)) {
      throw conflict(`Cannot transition application "${id}" from "${app.lifecycle}" to "${to}"`);
    }
    const next: ApplicationDefinition = { ...app, lifecycle: to, revision: app.revision + 1, updatedAt: new Date().toISOString() };
    this.store.save(next);
    return next;
  }

  /** APP-003 — page registry: applications resolve their pages through the Page Builder. */
  model(id: string): ApplicationModel {
    const definition = this.get(id);
    const pages = definition.pages.map((p) => this.pages.get(p.pageId)).filter((p): p is PageDefinition => p !== undefined);
    return { definition, pages, lifecycle: definition.lifecycle };
  }

  nextId(prefix = 'app'): string {
    return randomId(prefix);
  }
}
