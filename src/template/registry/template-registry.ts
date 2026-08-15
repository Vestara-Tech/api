import { notFound } from '../../core/errors.js';
import type { TemplateDefinition, TemplateKind } from '../domain/template-definition.js';

export interface TemplateRegistryPort {
  register(template: TemplateDefinition): void;
  get(id: string): TemplateDefinition | undefined;
  list(): readonly TemplateDefinition[];
  listByKind(kind: TemplateKind): readonly TemplateDefinition[];
  remove(id: string): void;
}

export class InMemoryTemplateRegistry implements TemplateRegistryPort {
  private readonly templates = new Map<string, TemplateDefinition>();

  register(template: TemplateDefinition): void {
    this.templates.set(template.id, template);
  }

  get(id: string): TemplateDefinition | undefined {
    return this.templates.get(id);
  }

  list(): readonly TemplateDefinition[] {
    return [...this.templates.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  listByKind(kind: TemplateKind): readonly TemplateDefinition[] {
    return this.list().filter((t) => t.kind === kind);
  }

  remove(id: string): void {
    this.templates.delete(id);
  }
}

/** TPL-005 — Template registry. One registry for all kinds; no per-kind engines. */
export class TemplateRegistry implements TemplateRegistryPort {
  private readonly templates = new Map<string, TemplateDefinition>();

  register(template: TemplateDefinition): void {
    this.templates.set(template.id, template);
  }

  get(id: string): TemplateDefinition | undefined {
    return this.templates.get(id);
  }

  getOrThrow(id: string): TemplateDefinition {
    const template = this.templates.get(id);
    if (!template) throw notFound(`Template "${id}" not found`);
    return template;
  }

  list(): readonly TemplateDefinition[] {
    return [...this.templates.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  listByKind(kind: TemplateKind): readonly TemplateDefinition[] {
    return this.list().filter((t) => t.kind === kind);
  }

  listKinds(): readonly TemplateKind[] {
    return [...new Set(this.list().map((t) => t.kind))].sort();
  }

  remove(id: string): void {
    this.templates.delete(id);
  }
}
