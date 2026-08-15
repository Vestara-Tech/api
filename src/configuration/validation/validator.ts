import type {
  ConfigurationDefinition,
  ConfigurationValidationIssue,
  ConfigurationValidationResult,
} from '../domain/types.js';
import { isSecretReference } from '../domain/secret.js';

export interface ValidatorLike {
  (schema: unknown, value: unknown): readonly string[];
}

/**
 * CONFIG-004 — Schema/value validation and diagnostics.
 *
 * The validator is injected (Fastify's TypeBox/Ajv compiler, or a minimal
 * structural checker) so configuration validation reuses the platform's JSON
 * Schema machinery. Secret fields must be `SecretReference`s, never literals.
 */
export class ConfigurationValidator {
  constructor(private readonly check: ValidatorLike) {}

  validateDefinition(definition: ConfigurationDefinition<unknown>): ConfigurationValidationResult {
    const issues: ConfigurationValidationIssue[] = [];
    if (!definition.namespace.trim()) {
      issues.push({ path: 'namespace', message: 'namespace is required', severity: 'error' });
    }
    if (!/^\d+\.\d+\.\d+$/.test(definition.version)) {
      issues.push({ path: 'version', message: 'version must be semver', severity: 'error' });
    }
    if (definition.scope.length === 0) {
      issues.push({ path: 'scope', message: 'at least one scope is required', severity: 'error' });
    }
    return { ok: issues.every((i) => i.severity !== 'error'), issues };
  }

  /** Validate a value against a definition's schema. */
  validateValue(definition: ConfigurationDefinition<unknown>, value: unknown): ConfigurationValidationResult {
    const issues: ConfigurationValidationIssue[] = [];
    const errors = this.check(definition.schema, value);
    for (const error of errors) {
      issues.push({ path: definition.namespace, message: error, severity: 'error' });
    }
    return { ok: issues.every((i) => i.severity !== 'error'), issues };
  }

  /** Ensure every secret field holds a SecretReference (or is absent). */
  validateSecrets(definition: ConfigurationDefinition<unknown>, value: Record<string, unknown>): ConfigurationValidationResult {
    const issues: ConfigurationValidationIssue[] = [];
    for (const field of definition.secretFields ?? []) {
      // Value map may be keyed by bare field name or fully-qualified key.
      const fieldValue = value[field] ?? value[`${definition.namespace}.${field}`];
      if (fieldValue === undefined) continue;
      if (typeof fieldValue === 'string' && fieldValue.startsWith('secret://')) continue;
      if (isSecretReference(fieldValue)) continue;
      issues.push({
        path: `${definition.namespace}.${field}`,
        message: `secret field "${field}" must be a SecretReference, not a literal value`,
        severity: 'error',
      });
    }
    return { ok: issues.every((i) => i.severity !== 'error'), issues };
  }
}
