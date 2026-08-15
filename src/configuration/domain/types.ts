/**
 * CONFIG-001 — Configuration domain contracts.
 *
 * Vestara's typed, layered, observable configuration control plane. Each
 * package registers a schema rather than inventing its own configuration
 * mechanism. Configuration stores values and secret REFERENCES — never secrets
 * directly.
 */

export type ConfigurationScope =
  | 'system'
  | 'environment'
  | 'organization'
  | 'workspace'
  | 'project'
  | 'module'
  | 'service'
  | 'runtime';

/** Scopes are extensible: core provides the built-ins, packages may add more. */
export type ConfigurationScopeLike = ConfigurationScope | string;

/** Precedence from lowest to highest. Later scopes override earlier ones. */
export const SCOPE_PRECEDENCE: readonly ConfigurationScope[] = [
  'system',
  'environment',
  'organization',
  'workspace',
  'project',
  'module',
  'service',
  'runtime',
];

export function precedenceIndex(scope: ConfigurationScopeLike): number {
  const index = SCOPE_PRECEDENCE.indexOf(scope as ConfigurationScope);
  return index === -1 ? SCOPE_PRECEDENCE.length : index;
}

export interface ConfigurationDefinition<TValue> {
  readonly namespace: string;
  readonly version: string;
  readonly schema: unknown;
  readonly defaults?: Partial<TValue>;
  readonly scope: readonly ConfigurationScope[];
  readonly secretFields?: readonly string[];
}

export interface ConfigurationKey {
  readonly namespace: string;
  readonly key: string; // fully-qualified dotted key, e.g. vestara.api.port
  readonly name: string; // key without the namespace prefix
  readonly secret: boolean;
  readonly defaultValue?: unknown;
}

export type ConfigurationValue = unknown;

export interface ResolvedConfigurationValue {
  readonly key: string;
  readonly value: ConfigurationValue;
  readonly scope: ConfigurationScopeLike;
  readonly source: 'default' | 'override' | 'runtime';
  readonly secret: boolean;
}

export interface ConfigurationValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export interface ConfigurationValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ConfigurationValidationIssue[];
}
