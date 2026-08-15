import type { ConfigurationProvenance, ConfigurationProvenanceEntry, ConfigurationScopeRef } from './expanded.js';
import type { ResolvedConfigurationValue } from './types.js';
import { CONFIG_SCOPE_PRECEDENCE } from './expanded.js';

/**
 * CONFIG-013 — Provenance engine. Every resolved value answers "where did
 * this come from?" with the full inheritance chain.
 */
export class ProvenanceEngine {
  build(scope: ConfigurationScopeRef, resolved: readonly ResolvedConfigurationValue[], byKey: (key: string) => readonly { scope: string; value?: unknown }[]): ConfigurationProvenance {
    const entries: ConfigurationProvenanceEntry[] = [];
    const scopeTypes = new Set(CONFIG_SCOPE_PRECEDENCE);
    for (const value of resolved) {
      const inherited = (byKey(value.key) ?? []).filter((layer) => scopeTypes.has(layer.scope as never)).map((layer) => ({ scope: layer.scope as ConfigurationScopeRef['type'], ...(layer.value !== undefined ? { value: layer.value } : {}) }));
      entries.push({
        key: value.key,
        effectiveValue: value.value,
        source: value.scope as never,
        inherited,
      });
    }
    return { scope, entries };
  }
}
