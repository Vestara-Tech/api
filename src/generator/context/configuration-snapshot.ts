import { hashOf } from '../domain/hash.js';
import { isSecretReference } from '../../configuration/domain/secret.js';

export interface ResolvedConfigValue {
  readonly key: string;
  readonly value: unknown;
  readonly scope: string;
  readonly secret: boolean;
}

export interface ConfigSecretReference {
  readonly key: string;
  readonly ref: string;
}

/**
 * An immutable snapshot of resolved configuration handed to a Generator. The
 * generator must not reach into the global Configuration service. Secret
 * fields appear as `secret://` REFERENCES only — never raw values.
 */
export interface ConfigurationSnapshot {
  readonly snapshotHash: string;
  readonly values: Readonly<Record<string, unknown>>;
  readonly scopes: Readonly<Record<string, string>>;
  readonly secretReferences: readonly ConfigSecretReference[];
  readonly secretsResolved: boolean;
}

export function createConfigurationSnapshot(resolved: readonly ResolvedConfigValue[]): ConfigurationSnapshot {
  const values: Record<string, unknown> = {};
  const scopes: Record<string, string> = {};
  const secretReferences: ConfigSecretReference[] = [];

  for (const entry of resolved) {
    values[entry.key] = entry.value;
    scopes[entry.key] = entry.scope;
    if (!entry.secret) continue;
    if (typeof entry.value === 'string' && entry.value.startsWith('secret://')) {
      secretReferences.push({ key: entry.key, ref: entry.value });
    } else if (isSecretReference(entry.value)) {
      secretReferences.push({ key: entry.key, ref: entry.value.ref });
    }
  }

  return {
    snapshotHash: hashOf({ values, scopes }),
    values,
    scopes,
    secretReferences,
    secretsResolved: false,
  };
}
