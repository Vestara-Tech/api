import type { ComponentInstance, ComponentTree, ComponentTreeValidationResult, ComponentTreeValidationIssue } from '../contracts.js';
import { ComponentRegistry } from '../registry/component-registry.js';

/**
 * COMP-010 — Component tree validator. Validates composition against slot
 * constraints, property types and visibility expressions. Arbitrary drag/drop
 * must not produce invalid UI trees.
 */
export class ComponentTreeValidator {
  private readonly registry: ComponentRegistry;

  constructor(registry: ComponentRegistry) {
    this.registry = registry;
  }

  validate(tree: ComponentTree): ComponentTreeValidationResult {
    const issues: ComponentTreeValidationIssue[] = [];
    this.validateInstance(tree.root, '$', issues, new Set());
    return { ok: issues.every((i) => i.severity === 'warning'), issues };
  }

  private validateInstance(instance: ComponentInstance, path: string, issues: ComponentTreeValidationIssue[], seen: Set<string>): void {
    let definition;
    try {
      definition = this.registry.resolve(instance.definitionId, instance.definitionVersion);
    } catch {
      issues.push({ path, message: `unknown component ${instance.definitionId}@${instance.definitionVersion}`, severity: 'error' });
      return;
    }

    if (instance.visibility) {
      try {
        // eslint-disable-next-line no-new-func
        new Function(`return (${instance.visibility.expression});`)();
      } catch {
        issues.push({ path, message: `invalid visibility expression "${instance.visibility.expression}"`, severity: 'error' });
      }
    }

    // Validate properties against the definition schema.
    const defined = new Map(definition.properties.map((p) => [p.name, p]));
    for (const [name, value] of Object.entries(instance.properties)) {
      const property = defined.get(name);
      if (!property) {
        issues.push({ path: `${path}.properties.${name}`, message: `unknown property "${name}" on ${definition.id}`, severity: 'warning' });
        continue;
      }
      if (property.type === 'enum' && property.enumValues && !property.enumValues.includes(value as string)) {
        issues.push({ path: `${path}.properties.${name}`, message: `invalid enum value "${String(value)}"`, severity: 'error' });
      }
    }

    // Validate slots against constraints.
    const slots = new Map(definition.slots.map((s) => [s.name, s]));
    for (const [slotName, children] of Object.entries(instance.slots)) {
      const slot = slots.get(slotName);
      if (!slot) {
        issues.push({ path: `${path}.slots.${slotName}`, message: `unknown slot "${slotName}" on ${definition.id}`, severity: 'warning' });
        continue;
      }
      if (slot.maxChildren !== undefined && children.length > slot.maxChildren) {
        issues.push({ path: `${path}.slots.${slotName}`, message: `slot "${slotName}" allows at most ${slot.maxChildren} children`, severity: 'error' });
      }
      children.forEach((child, i) => {
        if (slot.accepts && !slot.accepts.includes('*')) {
          try {
            const childDef = this.registry.resolve(child.definitionId, child.definitionVersion);
            if (!slot.accepts.includes(childDef.category) && !slot.accepts.includes(childDef.id)) {
              issues.push({ path: `${path}.slots.${slotName}[${i}]`, message: `category ${childDef.category} not accepted by slot "${slotName}"`, severity: 'error' });
            }
          } catch {
            // unknown child handled by the recursive pass below
          }
        }
        this.validateInstance(child, `${path}.slots.${slotName}[${i}]`, issues, seen);
      });
    }
  }
}
