import type { ConfigurationKey, ConfigurationScopeLike, ResolvedConfigurationValue } from '../domain/types.js';
import { precedenceIndex } from '../domain/types.js';
import { isSecretReference } from '../domain/secret.js';
import type { SchemaRegistry } from '../registry/schema-registry.js';

export interface ConfigurationLayers {
  /** Values per scope. Keys are fully-qualified dotted keys. */
  readonly [scope: string]: Readonly<Record<string, unknown>>;
}

export interface ResolveContext {
  readonly layerValues: (scope: ConfigurationScopeLike) => Readonly<Record<string, unknown>>;
  readonly runtimeValues?: Readonly<Record<string, unknown>>;
}

/**
 * CONFIG-003 — Layered resolver with deterministic precedence.
 *
 * Resolution walks scopes from lowest to highest precedence; the highest
 * scope that defines a key wins. Runtime overrides (set programmatically) take
 * top priority. Secret references are resolved as references, never values.
 */
export class LayeredResolver {
  constructor(
    private readonly registry: SchemaRegistry,
    private readonly layers: ConfigurationLayers,
  ) {}

  resolve(key: string, runtimeValues?: Readonly<Record<string, unknown>>): ResolvedConfigurationValue | null {
    const keyMeta = this.registry.keys().find((k) => k.key === key);
    if (!keyMeta) return null;

    if (runtimeValues && key in runtimeValues) {
      return {
        key,
        value: runtimeValues[key]!,
        scope: 'runtime',
        source: 'runtime',
        secret: keyMeta.secret,
      };
    }

    // Highest-precedence scope that defines the key wins. Walk from highest
    // (runtime) down to lowest (system).
    for (let i = SCOPE_ORDER.length - 1; i >= 0; i -= 1) {
      const scope = SCOPE_ORDER[i]!;
      const layer = this.layers[scope];
      if (layer && key in layer) {
        return {
          key,
          value: layer[key]!,
          scope,
          source: scope === 'system' ? 'default' : 'override',
          secret: keyMeta.secret,
        };
      }
    }

    const defaultValue = keyMeta.defaultValue;
    if (defaultValue !== undefined) {
      return { key, value: defaultValue, scope: 'system', source: 'default', secret: keyMeta.secret };
    }
    return null;
  }

  /** Resolve every registered key. */
  resolveAll(runtimeValues?: Readonly<Record<string, unknown>>): readonly ResolvedConfigurationValue[] {
    const out: ResolvedConfigurationValue[] = [];
    for (const key of this.registry.keys()) {
      const resolved = this.resolve(key.key, runtimeValues);
      if (resolved) out.push(resolved);
    }
    return out;
  }

  /** Plain record of resolved values, with secret references intact. */
  asRecord(runtimeValues?: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    for (const value of this.resolveAll(runtimeValues)) {
      out[value.key] = value.value;
    }
    return out;
  }

  /** True if a key resolves to a secret reference. */
  isSecret(key: string): boolean {
    return this.registry.keys().some((k) => k.key === key && k.secret);
  }

  hasKey(key: string): boolean {
    return this.registry.keys().some((k) => k.key === key);
  }
}

export { isSecretReference };

const SCOPE_ORDER: readonly ConfigurationScopeLike[] = [
  'system',
  'environment',
  'organization',
  'workspace',
  'project',
  'module',
  'service',
  'runtime',
];
void precedenceIndex;
