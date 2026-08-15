import { badRequest } from '../core/errors.js';
import type { BuilderDefinition, BuilderContribution } from './contracts.js';
import { BuilderRegistry } from './registry.js';
import { BuilderStore } from './store.js';

/**
 * BLD-X02 — generic builder lifecycle. draft -> validating -> ready ->
 * publishing -> published, plus invalid/superseded/archived. Builder publish ≠
 * Generator apply ≠ Runtime activate.
 */
export class BuilderLifecycle {
  private readonly store: BuilderStore;
  private readonly registry: BuilderRegistry;

  constructor(store: BuilderStore, registry: BuilderRegistry) {
    this.store = store;
    this.registry = registry;
  }

  validate<TKind extends string, TSpec>(id: string): BuilderDefinition<TKind, TSpec> {
    const definition = this.store.get<TKind, TSpec>(id);
    const contribution = this.registry.resolve<TSpec>(definition.kind);
    const result = contribution.validator.validate(definition.spec);
    const next = this.store.save<TKind, TSpec>({ ...definition, status: result.ok ? 'ready' : 'invalid' });
    return next;
  }

  publish<TKind extends string, TSpec>(id: string): BuilderDefinition<TKind, TSpec> {
    const definition = this.store.get<TKind, TSpec>(id);
    if (definition.status === 'published') return definition;
    const published = this.store.save<TKind, TSpec>({
      ...definition,
      status: 'published',
      revision: definition.revision + 1,
    });
    this.store.recordRevision(published);
    return published;
  }

  supersede<TKind extends string, TSpec>(id: string): BuilderDefinition<TKind, TSpec> {
    const definition = this.store.get<TKind, TSpec>(id);
    return this.store.save<TKind, TSpec>({ ...definition, status: 'superseded' });
  }

  archive<TKind extends string, TSpec>(id: string): BuilderDefinition<TKind, TSpec> {
    const definition = this.store.get<TKind, TSpec>(id);
    return this.store.save<TKind, TSpec>({ ...definition, status: 'archived' });
  }

  compile<TSpec>(kind: string, spec: TSpec): unknown {
    const contribution = this.registry.resolve<TSpec>(kind);
    if (!contribution.compiler) return undefined;
    return contribution.compiler.compile(spec);
  }
}
