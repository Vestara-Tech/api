import type { ConfigurationChange, ConfigurationImpact, ConfigurationRisk } from './expanded.js';
import type { ConfigurationContributionRegistry } from '../registry/contribution-registry.js';

/**
 * CONFIG-015 — Impact analyzer. Calculates the operational impact of a set of
 * configuration changes: affected modules/services, required restarts,
 * regeneration, reboot and overall risk. Config changes are much safer when
 * the impact is known before apply.
 */
export class ConfigurationImpactAnalyzer {
  constructor(private readonly registry: ConfigurationContributionRegistry) {}

  analyze(changes: readonly ConfigurationChange[]): ConfigurationImpact {
    const affectedModules = new Set<string>();
    const affectedServices = new Set<string>();
    const requiredRestarts = new Set<string>();
    const requiresRegeneration = new Set<string>();
    let requiresReboot = false;
    let risk: ConfigurationRisk = 'low';

    for (const change of changes) {
      const field = this.registry.getFieldOrNull(change.key);
      if (!field) continue;
      const namespace = change.key.split('.')[0] ?? 'unknown';
      affectedModules.add(namespace);
      affectedServices.add(`${namespace}-service`);
      const reload = field.reloadBehavior;
      if (reload === 'service-restart') requiredRestarts.add(namespace);
      if (reload === 'system-reboot') requiresReboot = true;
      if (reload === 'system-reboot') requiresRegeneration.add(namespace);
      if (field.risk === 'critical') risk = 'critical';
      else if (field.risk === 'high' && risk !== 'critical') risk = 'high';
      else if (field.risk === 'medium' && (risk === 'low')) risk = 'medium';
    }

    return {
      affectedModules: [...affectedModules].sort(),
      affectedServices: [...affectedServices].sort(),
      requiredPermissions: [...affectedModules].map((m) => `config.write.${m}`),
      requiredRestarts: [...requiredRestarts].sort(),
      requiresRegeneration: [...requiresRegeneration].sort(),
      requiresReboot,
      risk,
      summary: `${changes.length} change(s) across ${affectedModules.size} module(s), risk ${risk}`,
    };
  }
}
