import type { TemplateDefinition, TemplateParameterValues, TemplateContext } from './template-definition.js';
import { resolveTemplateValue } from './template-definition.js';

export interface TemplateValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export interface TemplateValidationResult {
  readonly ok: boolean;
  readonly issues: readonly TemplateValidationIssue[];
}

/** TPL-007 — template validation. Required parameters, kinds and capabilities. */
export function validateTemplate(template: TemplateDefinition): TemplateValidationResult {
  const issues: TemplateValidationIssue[] = [];
  if (!template.id) issues.push({ path: 'id', message: 'Template id is required', severity: 'error' });
  if (!template.name) issues.push({ path: 'name', message: 'Template name is required', severity: 'error' });
  if (!template.metadata.version) issues.push({ path: 'metadata.version', message: 'Template version is required', severity: 'error' });

  const parameterNames = new Set<string>();
  for (const parameter of template.parameters) {
    if (parameterNames.has(parameter.name)) issues.push({ path: `parameters.${parameter.name}`, message: 'Duplicate parameter name', severity: 'error' });
    parameterNames.add(parameter.name);
  }
  if (template.recommendedThemeId && template.recommendedThemeId.length === 0) {
    issues.push({ path: 'recommendedThemeId', message: 'Empty recommended theme', severity: 'warning' });
  }
  return { ok: issues.every((i) => i.severity !== 'error'), issues };
}

/** TPL-004 — validate supplied parameter values against the schema + merge defaults. */
export function validateParameterValues(template: TemplateDefinition, values: TemplateParameterValues): readonly string[] {
  const errors: string[] = [];
  for (const parameter of template.parameters) {
    const value = values[parameter.name];
    if (parameter.required && (value === undefined || value === null || value === '')) {
      errors.push(`Parameter "${parameter.name}" is required`);
      continue;
    }
    if (parameter.type === 'enum' && parameter.enumValues && value !== undefined && !parameter.enumValues.includes(String(value))) {
      errors.push(`Parameter "${parameter.name}" must be one of ${parameter.enumValues.join(', ')}`);
    }
    if (parameter.type === 'number' && value !== undefined && typeof value === 'string' && Number.isNaN(Number(value))) {
      errors.push(`Parameter "${parameter.name}" must be a number`);
    }
  }
  return errors;
}

/** Merge schema defaults into supplied values (supplied wins). */
export function mergeParameterDefaults(template: TemplateDefinition, values: TemplateParameterValues): TemplateParameterValues {
  const merged: TemplateParameterValues = {};
  for (const parameter of template.parameters) {
    if (parameter.defaultValue !== undefined) merged[parameter.name] = parameter.defaultValue;
  }
  return { ...merged, ...values };
}

/** TPL-008 — revision/lifecycle. */
export function bumpTemplateVersion(template: TemplateDefinition, version: string): TemplateDefinition {
  return { ...template, version, metadata: { ...template.metadata, version } };
}

/** Instantiate a template with parameters + context (deep string resolution). */
export function instantiateTemplate<TDefinition>(template: TemplateDefinition<TDefinition>, values: TemplateParameterValues, context: Partial<Omit<TemplateContext, 'parameters'>> = {}): TDefinition {
  const fullContext: TemplateContext = { parameters: values, ...context };
  return resolveTemplateValue(template.definition, fullContext) as TDefinition;
}
