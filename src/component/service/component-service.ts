import { randomId } from '../../core/identifiers.js';
import { badRequest } from '../../core/errors.js';
import type { ComponentDefinition, ComponentTree } from '../contracts.js';
import { ComponentRegistry } from '../registry/component-registry.js';
import { ComponentTreeValidator } from '../tree/tree-validator.js';

export interface ComponentServiceOptions {
  readonly registry: ComponentRegistry;
}

/**
 * COMP-013 — Component service. Lifecycle/versioning: published versions are
 * immutable; edits always create a new draft version. Owns component trees.
 */
export class ComponentService {
  private readonly registry: ComponentRegistry;
  private readonly trees = new Map<string, ComponentTree>();
  private readonly validator: ComponentTreeValidator;

  constructor(options: ComponentServiceOptions) {
    this.registry = options.registry;
    this.validator = new ComponentTreeValidator(options.registry);
  }

  register(definition: ComponentDefinition): ComponentDefinition {
    this.registry.register(definition);
    return definition;
  }

  /** Editing a published component creates a NEW version (immutable published). */
  createNextVersion(definition: ComponentDefinition, nextVersion: string): ComponentDefinition {
    const current = this.registry.resolve(definition.id, definition.version);
    const next: ComponentDefinition = { ...current, version: nextVersion, status: 'draft' };
    this.registry.register(next);
    return next;
  }

  validateComponent(id: string): { ok: boolean; issues: readonly { path: string; message: string; severity: string }[] } {
    const definition = this.registry.resolve(id);
    const issues: { path: string; message: string; severity: string }[] = [];
    if (!definition.displayName) issues.push({ path: 'displayName', message: 'displayName is required', severity: 'error' });
    if (definition.slots.length === 0 && definition.category !== 'primitive') {
      issues.push({ path: 'slots', message: 'non-primitive component should declare slots', severity: 'warning' });
    }
    return { ok: issues.every((i) => i.severity !== 'error'), issues };
  }

  createTree(input: { id: string; name: string; root: ComponentTree['root'] }): ComponentTree {
    const now = new Date().toISOString();
    const tree: ComponentTree = { id: input.id, name: input.name, root: input.root, createdAt: now, updatedAt: now };
    this.trees.set(tree.id, tree);
    return tree;
  }

  getTree(id: string): ComponentTree {
    const tree = this.trees.get(id);
    if (!tree) throw badRequest(`Component tree "${id}" not found`);
    return tree;
  }

  listTrees(): readonly ComponentTree[] {
    return [...this.trees.values()];
  }

  validateTree(id: string): ReturnType<ComponentTreeValidator['validate']> {
    return this.validator.validate(this.getTree(id));
  }
}

export function componentId(prefix = 'comp'): string {
  return `${prefix}_${randomId(prefix).slice(prefix.length + 1)}`;
}
