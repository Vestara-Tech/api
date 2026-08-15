import { conflict, notFound } from '../../core/errors.js';
import type { TemplateDefinition, TemplateKind, TemplateParameterValues } from '../domain/template-definition.js';
import type { TemplateRegistryPort } from '../registry/template-registry.js';
import { InMemoryTemplateRegistry } from '../registry/template-registry.js';
import { validateTemplate, validateParameterValues, instantiateTemplate, mergeParameterDefaults } from '../domain/template-validator.js';

export interface TemplateServiceOptions {
  readonly registry?: TemplateRegistryPort;
}

export interface TemplateInstantiationResult<TDefinition = unknown> {
  readonly template: TemplateDefinition<TDefinition>;
  readonly definition: TDefinition;
}

/** TPL — Template service. One registry for all kinds; instantiation resolves parameters + context. */
export class TemplateService {
  private readonly registry: TemplateRegistryPort;

  constructor(options: TemplateServiceOptions = {}) {
    this.registry = options.registry ?? new InMemoryTemplateRegistry();
  }

  register(template: TemplateDefinition): TemplateDefinition {
    const validation = validateTemplate(template);
    if (!validation.ok) throw conflict(`Invalid template: ${validation.issues.map((i) => i.message).join('; ')}`);
    this.registry.register(template);
    return template;
  }

  get(id: string): TemplateDefinition {
    const template = this.registry.get(id);
    if (!template) throw notFound(`Template "${id}" not found`);
    return template;
  }

  list(): readonly TemplateDefinition[] {
    return this.registry.list();
  }

  listByKind(kind: TemplateKind): readonly TemplateDefinition[] {
    return this.registry.listByKind(kind);
  }

  remove(id: string): void {
    if (!this.registry.get(id)) throw notFound(`Template "${id}" not found`);
    this.registry.remove(id);
  }

  /** TPL-004 — instantiate a template with validated parameter values. */
  instantiate<TDefinition>(id: string, values: TemplateParameterValues, context: Record<string, unknown> = {}): TemplateInstantiationResult<TDefinition> {
    const template = this.get(id) as TemplateDefinition<TDefinition>;
    const merged = mergeParameterDefaults(template, values);
    const errors = validateParameterValues(template, merged);
    if (errors.length > 0) throw conflict(`Invalid parameters: ${errors.join('; ')}`);
    const definition = instantiateTemplate(template, merged, context);
    return { template, definition };
  }
}
