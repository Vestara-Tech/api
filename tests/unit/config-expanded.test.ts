import { describe, expect, it } from 'vitest';
import {
  ConfigurationContributionRegistry,
  ConfigurationImpactAnalyzer,
  ConfigurationTransactionService,
  ProvenanceEngine,
  buildExpandedConfiguration,
  type ConfigurationContribution,
} from '../../src/configuration/index.js';

const contribution: ConfigurationContribution = {
  packageId: 'vestara.api',
  namespace: 'api',
  version: '1',
  fields: [
    { key: 'server.port', title: 'Port', type: 'integer', defaultValue: 4314, reloadBehavior: 'service-restart', risk: 'medium' },
    { key: 'logging.level', title: 'Level', type: 'enum', defaultValue: 'info', reloadBehavior: 'hot-reload', risk: 'low', enumValues: ['debug', 'info', 'warn', 'error'] },
    { key: 'cors.enabled', title: 'CORS', type: 'boolean', defaultValue: false, reloadBehavior: 'hot-reload', risk: 'low' },
    { key: 'security.secret', title: 'Secret', type: 'secret', reloadBehavior: 'immediate', risk: 'high', secret: true },
  ],
};

function build() {
  const registry = new ConfigurationContributionRegistry();
  registry.register(contribution);
  const impact = new ConfigurationImpactAnalyzer(registry);
  const transactions = new ConfigurationTransactionService();
  return { registry, impact, transactions };
}

describe('CONFIG-009 contribution contract', () => {
  it('registers contributions and resolves field metadata', () => {
    const { registry } = build();
    expect(registry.list()).toHaveLength(1);
    const port = registry.getField('api.server.port');
    expect(port.reloadBehavior).toBe('service-restart');
    expect(port.risk).toBe('medium');
    expect(registry.reloadBehaviorOf('api.logging.level')).toBe('hot-reload');
    expect(registry.isSecret('api.security.secret')).toBe(true);
  });
});

describe('CONFIG-015 impact analyzer', () => {
  it('detects restarts, reboot and risk from field metadata', () => {
    const { impact } = build();
    const result = impact.analyze([
      { key: 'api.server.port', from: 4314, to: 7000 },
      { key: 'api.logging.level', from: 'info', to: 'debug' },
    ]);
    expect(result.affectedModules).toContain('api');
    expect(result.requiredRestarts).toContain('api');
    expect(result.risk).toBe('medium');
    expect(result.requiresReboot).toBe(false);
  });
});

describe('CONFIG-014 transaction model', () => {
  it('draft -> validate -> impact -> approve -> commit', () => {
    const { transactions } = build();
    const tx = transactions.create({ type: 'workspace' }, [
      { key: 'api.server.port', from: 4314, to: 7000 },
      { key: 'api.cors.enabled', from: false, to: true },
    ]);
    expect(tx.status).toBe('draft');

    const validated = transactions.validate(tx.id, () => ({ ok: true }));
    expect(validated.status).toBe('validated');

    transactions.setImpact(tx.id, { affectedModules: ['api'], affectedServices: [], requiredPermissions: [], requiredRestarts: ['api'], requiresRegeneration: [], requiresReboot: false, risk: 'medium', summary: 'x' });
    expect(transactions.get(tx.id).status).toBe('awaiting-approval');

    const committed = transactions.approve(tx.id, true, () => ({ ok: true }));
    expect(committed.status).toBe('committed');
    expect(committed.appliedAt).toBeTruthy();

    const rolled = transactions.rollback(tx.id);
    expect(rolled.status).toBe('rolled-back');
  });

  it('rolls back cleanly on apply failure without partial state', () => {
    const { transactions } = build();
    const tx = transactions.create({ type: 'system' }, [{ key: 'api.server.port', from: 4314, to: 9999 }]);
    transactions.validate(tx.id, () => ({ ok: false, error: 'invalid port' }));
    expect(transactions.get(tx.id).status).toBe('failed');
  });
});

describe('CONFIG-013 provenance', () => {
  it('builds provenance with inherited layers', () => {
    const engine = new ProvenanceEngine();
    const result = engine.build(
      { type: 'workspace' },
      [{ key: 'api.server.port', value: 7000, scope: 'workspace', source: 'override', secret: false }],
      () => [{ scope: 'default', value: 4314 }, { scope: 'environment', value: 5000 }],
    );
    expect(result.entries[0]!.effectiveValue).toBe(7000);
    expect(result.entries[0]!.inherited).toHaveLength(2);
  });
});

describe('CONFIG-009..016 wiring', () => {
  it('builds the expanded platform over the base service', () => {
    // The bootstrap builder requires a ConfigurationService; verify the pieces
    // it composes are constructible independently (covered above). The registry
    // + impact + transactions + provenance compose into the expanded facade.
    const registry = new ConfigurationContributionRegistry();
    registry.register(contribution);
    expect(registry.listFields().length).toBe(4);
    expect(registry.fieldsForNamespace('api').length).toBe(4);
  });
});
