import type { ApiDefinition, ApiField } from '../domain/types.js';

export type CompatibilityClassification = 'compatible' | 'breaking' | 'unknown';

export interface CompatibilityChange {
  readonly kind: string;
  readonly path: string;
  readonly severity: 'breaking' | 'compatible' | 'info';
  readonly message: string;
}

export interface CompatibilityResult {
  readonly classification: CompatibilityClassification;
  readonly changes: readonly CompatibilityChange[];
}

/**
 * Compares a candidate definition against a baseline (typically the currently
 * published revision) and classifies the delta. Used by the Builder preview to
 * tell the user whether publishing would break existing consumers.
 *
 * API2-004 will deepen this into a full contract diff; this is the minimal
 * surface the preview contract needs today.
 */
export class CompatibilityAnalyzer {
  analyze(candidate: ApiDefinition, baseline: ApiDefinition | null): CompatibilityResult {
    if (!baseline) {
      return { classification: 'compatible', changes: [] };
    }
    const changes: CompatibilityChange[] = [];
    this.diffResources(candidate, baseline, changes);
    this.diffEndpoints(candidate, baseline, changes);
    const classification = changes.some((c) => c.severity === 'breaking') ? 'breaking' : 'compatible';
    return { classification, changes };
  }

  private diffResources(candidate: ApiDefinition, baseline: ApiDefinition, changes: CompatibilityChange[]): void {
    const baselineResources = new Map(baseline.resources.map((r) => [r.name, r]));
    const candidateResources = new Map(candidate.resources.map((r) => [r.name, r]));

    for (const [name, baselineResource] of baselineResources) {
      if (!candidateResources.has(name)) {
        changes.push({ kind: 'resource-removed', path: `resources.${name}`, severity: 'breaking', message: `resource "${name}" was removed` });
        continue;
      }
      this.diffFields(name, candidateResources.get(name)!.fields, baselineResource.fields, changes);
    }
    for (const name of candidateResources.keys()) {
      if (!baselineResources.has(name)) {
        changes.push({ kind: 'resource-added', path: `resources.${name}`, severity: 'compatible', message: `resource "${name}" was added` });
      }
    }
  }

  private diffFields(resource: string, candidateFields: readonly ApiField[], baselineFields: readonly ApiField[], changes: CompatibilityChange[]): void {
    const baseline = new Map(baselineFields.map((f) => [f.name, f]));
    const candidate = new Map(candidateFields.map((f) => [f.name, f]));

    for (const [name, baselineField] of baseline) {
      const candidateField = candidate.get(name);
      if (!candidateField) {
        changes.push({ kind: 'field-removed', path: `resources.${resource}.fields.${name}`, severity: 'breaking', message: `field "${name}" was removed` });
        continue;
      }
      if (candidateField.type !== baselineField.type) {
        changes.push({
          kind: 'field-type-changed',
          path: `resources.${resource}.fields.${name}`,
          severity: 'breaking',
          message: `field "${name}" changed type ${baselineField.type} → ${candidateField.type}`,
        });
      }
      if (!baselineField.required && candidateField.required) {
        changes.push({
          kind: 'field-required-changed',
          path: `resources.${resource}.fields.${name}`,
          severity: 'breaking',
          message: `field "${name}" became required`,
        });
      }
    }
    for (const [name] of candidate) {
      if (!baseline.has(name)) {
        changes.push({ kind: 'field-added', path: `resources.${resource}.fields.${name}`, severity: 'compatible', message: `field "${name}" was added` });
      }
    }
  }

  private diffEndpoints(candidate: ApiDefinition, baseline: ApiDefinition, changes: CompatibilityChange[]): void {
    const baselineEndpoints = new Set(baseline.endpoints.map((e) => `${e.method} ${e.path}`));
    const candidateEndpoints = new Set(candidate.endpoints.map((e) => `${e.method} ${e.path}`));

    for (const key of baselineEndpoints) {
      if (!candidateEndpoints.has(key)) {
        changes.push({ kind: 'endpoint-removed', path: key, severity: 'breaking', message: `endpoint ${key} was removed` });
      }
    }
    for (const key of candidateEndpoints) {
      if (!baselineEndpoints.has(key)) {
        changes.push({ kind: 'endpoint-added', path: key, severity: 'compatible', message: `endpoint ${key} was added` });
      }
    }
  }
}
