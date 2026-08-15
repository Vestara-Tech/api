import { conflict } from '../../core/errors.js';
import type { ConfigurationDefinition, ConfigurationKey } from '../domain/types.js';

/**
 * CONFIG-002 — Schema registry.
 *
 * Packages/modules register a `ConfigurationDefinition` (schema + defaults +
 * scope + secret fields). The registry derives the fully-qualified leaf keys so
 * resolvers, validators, and the control API share one key model.
 */
export class SchemaRegistry {
  private readonly definitions = new Map<string, ConfigurationDefinition<unknown>>();

  register<TValue>(definition: ConfigurationDefinition<TValue>): void {
    if (this.definitions.has(definition.namespace)) {
      throw conflict(`Configuration namespace "${definition.namespace}" already registered`);
    }
    this.definitions.set(definition.namespace, definition as ConfigurationDefinition<unknown>);
  }

  registerOrReplace<TValue>(definition: ConfigurationDefinition<TValue>): void {
    this.definitions.set(definition.namespace, definition as ConfigurationDefinition<unknown>);
  }

  unregister(namespace: string): boolean {
    return this.definitions.delete(namespace);
  }

  has(namespace: string): boolean {
    return this.definitions.has(namespace);
  }

  get<TValue = unknown>(namespace: string): ConfigurationDefinition<TValue> | undefined {
    return this.definitions.get(namespace) as ConfigurationDefinition<TValue> | undefined;
  }

  list(): readonly ConfigurationDefinition<unknown>[] {
    return [...this.definitions.values()].sort((a, b) => a.namespace.localeCompare(b.namespace));
  }

  /** All fully-qualified leaf keys across registered namespaces. */
  keys(): readonly ConfigurationKey[] {
    const out: ConfigurationKey[] = [];
    for (const definition of this.definitions.values()) {
      const secrets = new Set(definition.secretFields ?? []);
      const defaults = (definition.defaults ?? {}) as Record<string, unknown>;
      for (const [leaf, value] of leafEntries(defaults)) {
        out.push({
          namespace: definition.namespace,
          key: `${definition.namespace}.${leaf}`,
          name: leaf,
          secret: secrets.has(leaf),
          defaultValue: value,
        });
      }
    }
    return out.sort((a, b) => a.key.localeCompare(b.key));
  }

  namespaceCount(): number {
    return this.definitions.size;
  }
}

/** Flatten a nested defaults object into dotted leaf keys. */
export function leafEntries(record: Record<string, unknown>, prefix = ''): Array<[string, unknown]> {
  const out: Array<[string, unknown]> = [];
  for (const [name, value] of Object.entries(record)) {
    const path = prefix ? `${prefix}.${name}` : name;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      out.push(...leafEntries(value as Record<string, unknown>, path));
    } else {
      out.push([path, value]);
    }
  }
  return out;
}
