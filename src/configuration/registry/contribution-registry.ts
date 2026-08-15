import { conflict, notFound } from '../../core/errors.js';
import type { ConfigurationContribution, ConfigurationFieldDefinition, ReloadBehavior, ConfigurationRisk } from '../domain/expanded.js';

/**
 * CONFIG-009 — Configuration contribution registry. Every package contributes
 * schemas with operational metadata (reloadBehavior, risk). Marketplace
 * installation registers these automatically.
 */
export class ConfigurationContributionRegistry {
  private readonly contributions = new Map<string, ConfigurationContribution>();
  private readonly fields = new Map<string, ConfigurationFieldDefinition>();

  register(contribution: ConfigurationContribution): void {
    if (this.contributions.has(contribution.packageId)) throw conflict(`Configuration contribution "${contribution.packageId}" already registered`);
    this.contributions.set(contribution.packageId, contribution);
    for (const field of contribution.fields) {
      this.fields.set(`${contribution.namespace}.${field.key}`, field);
    }
  }

  getField(key: string): ConfigurationFieldDefinition {
    const field = this.fields.get(key);
    if (!field) throw notFound(`No configuration field for key "${key}"`);
    return field;
  }

  getFieldOrNull(key: string): ConfigurationFieldDefinition | undefined {
    return this.fields.get(key);
  }

  listFields(): readonly ConfigurationFieldDefinition[] {
    return [...this.fields.values()];
  }

  fieldsForNamespace(namespace: string): readonly ConfigurationFieldDefinition[] {
    const prefix = `${namespace}.`;
    return [...this.fields.entries()].filter(([qualified]) => qualified.startsWith(prefix)).map(([, field]) => field);
  }

  reloadBehaviorOf(key: string): ReloadBehavior {
    return this.getFieldOrNull(key)?.reloadBehavior ?? 'hot-reload';
  }

  riskOf(key: string): ConfigurationRisk {
    return this.getFieldOrNull(key)?.risk ?? 'low';
  }

  isSecret(key: string): boolean {
    return this.getFieldOrNull(key)?.secret ?? false;
  }

  list(): readonly ConfigurationContribution[] {
    return [...this.contributions.values()].sort((a, b) => a.packageId.localeCompare(b.packageId));
  }
}
