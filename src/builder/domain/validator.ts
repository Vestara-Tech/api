import type { ApiDefinition, ApiFieldType, ValidationIssue, ValidationResult } from './types.js';

const VALID_FIELD_TYPES = new Set<ApiFieldType>([
  'string',
  'text',
  'number',
  'integer',
  'boolean',
  'uuid',
  'email',
  'url',
  'date',
  'date-time',
  'json',
  'enum',
  'relation',
]);

export class DefinitionValidator {
  validate(definition: ApiDefinition): ValidationResult {
    const issues: ValidationIssue[] = [];
    this.validateIdentity(definition, issues);
    this.validateResources(definition, issues);
    this.validateEndpoints(definition, issues);
    this.validatePolicies(definition, issues);
    return { ok: issues.every((i) => i.severity === 'warning'), issues };
  }

  private validateIdentity(definition: ApiDefinition, issues: ValidationIssue[]): void {
    if (!definition.name.trim()) issues.push({ path: 'name', message: 'name is required', severity: 'error' });
    if (!definition.namespace.trim()) issues.push({ path: 'namespace', message: 'namespace is required', severity: 'error' });
    if (!/^\d+\.\d+\.\d+$/.test(definition.version)) {
      issues.push({ path: 'version', message: 'version must be semver (x.y.z)', severity: 'error' });
    }
    if (definition.resources.length === 0) {
      issues.push({ path: 'resources', message: 'at least one resource is required', severity: 'error' });
    }
  }

  private validateResources(definition: ApiDefinition, issues: ValidationIssue[]): void {
    const resourceNames = new Map<string, string>();
    for (const resource of definition.resources) {
      resourceNames.set(resource.name, resource.id);
    }
    for (const resource of definition.resources) {
      if (!resource.name.trim()) {
        issues.push({ path: `resources[${resource.id}].name`, message: 'resource name is required', severity: 'error' });
      }
      const fieldNames = new Set<string>();
      for (const field of resource.fields) {
        const path = `resources[${resource.name}].fields[${field.name}]`;
        if (!field.name.trim()) issues.push({ path, message: 'field name is required', severity: 'error' });
        if (fieldNames.has(field.name)) issues.push({ path, message: `duplicate field name "${field.name}"`, severity: 'error' });
        fieldNames.add(field.name);
        if (!VALID_FIELD_TYPES.has(field.type)) {
          issues.push({ path, message: `unknown field type "${field.type}"`, severity: 'error' });
        }
        if (field.type === 'enum' && (!field.enumValues || field.enumValues.length === 0)) {
          issues.push({ path, message: 'enum field requires enumValues', severity: 'error' });
        }
      }
      for (const relation of resource.relations ?? []) {
        if (!resourceNames.has(relation.targetResource)) {
          issues.push({
            path: `resources[${resource.name}].relations[${relation.name}]`,
            message: `relation target resource "${relation.targetResource}" does not exist`,
            severity: 'error',
          });
        }
      }
    }
  }

  private validateEndpoints(definition: ApiDefinition, issues: ValidationIssue[]): void {
    const seen = new Set<string>();
    for (const endpoint of definition.endpoints) {
      const path = `endpoints[${endpoint.method} ${endpoint.path}]`;
      const key = `${endpoint.method} ${endpoint.path}`;
      if (seen.has(key)) issues.push({ path, message: `duplicate endpoint ${key}`, severity: 'error' });
      seen.add(key);
      if (!endpoint.path.startsWith('/')) {
        issues.push({ path, message: 'endpoint path must start with "/"', severity: 'error' });
      }
      for (const param of endpoint.parameters ?? []) {
        if (param.in === 'path' && !endpoint.path.includes(`:${param.name}`)) {
          issues.push({ path, message: `path parameter :${param.name} not present in path`, severity: 'error' });
        }
      }
      for (const policyId of endpoint.policyIds ?? []) {
        if (!definition.policies.some((p) => p.id === policyId)) {
          issues.push({ path, message: `policy "${policyId}" not declared`, severity: 'error' });
        }
      }
    }
  }

  private validatePolicies(definition: ApiDefinition, issues: ValidationIssue[]): void {
    const names = new Set<string>();
    for (const policy of definition.policies) {
      if (names.has(policy.name)) {
        issues.push({ path: `policies[${policy.name}]`, message: `duplicate policy name "${policy.name}"`, severity: 'error' });
      }
      names.add(policy.name);
    }
  }
}
