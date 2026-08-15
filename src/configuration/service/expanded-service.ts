import type { ConfigurationContribution, ConfigurationFieldDefinition, ConfigurationProvenance, ConfigurationScopeRef, ConfigurationTransaction } from '../domain/expanded.js';
import { ConfigurationContributionRegistry } from '../registry/contribution-registry.js';
import { ProvenanceEngine } from '../domain/provenance.js';
import { ConfigurationImpactAnalyzer } from '../domain/impact.js';
import { ConfigurationTransactionService } from './transaction-service.js';
import type { ConfigurationService } from './configuration-service.js';

export interface ExpandedConfigurationServiceOptions {
  readonly contributions: ConfigurationContributionRegistry;
  readonly provenance: ProvenanceEngine;
  readonly impact: ConfigurationImpactAnalyzer;
  readonly transactions: ConfigurationTransactionService;
  readonly base: ConfigurationService;
}

/**
 * CONFIG-009..016 — Expanded configuration service. Package contribution
 * contract, scope hierarchy, provenance, transactions, impact analysis —
 * the configuration control plane for all Vestara packages.
 */
export class ExpandedConfigurationService {
  private readonly contributions: ConfigurationContributionRegistry;
  private readonly provenanceEngine: ProvenanceEngine;
  private readonly impact: ConfigurationImpactAnalyzer;
  private readonly transactions: ConfigurationTransactionService;
  private readonly base: ConfigurationService;

  constructor(options: ExpandedConfigurationServiceOptions) {
    this.contributions = options.contributions;
    this.provenanceEngine = options.provenance;
    this.impact = options.impact;
    this.transactions = options.transactions;
    this.base = options.base;
  }

  registerContribution(contribution: ConfigurationContribution): void {
    this.contributions.register(contribution);
  }

  listContributions(): readonly ConfigurationContribution[] {
    return this.contributions.list();
  }

  listFields(): readonly ConfigurationFieldDefinition[] {
    return this.contributions.listFields();
  }

  getField(key: string): ConfigurationFieldDefinition {
    return this.contributions.getField(key);
  }

  provenance(scope: ConfigurationScopeRef): ConfigurationProvenance {
    const resolved = this.base.resolveAll();
    return this.provenanceEngine.build(scope, resolved, (key) => {
      const field = this.contributions.getFieldOrNull(key);
      return field ? [{ scope: 'default', value: field.defaultValue }] : [];
    });
  }

  analyzeImpact(changes: { key: string; from: unknown; to: unknown }[]) {
    return this.impact.analyze(changes);
  }

  createTransaction(scope: ConfigurationScopeRef, changes: { key: string; from: unknown; to: unknown }[]): ConfigurationTransaction {
    return this.transactions.create(scope, changes);
  }

  getTransaction(id: string): ConfigurationTransaction {
    return this.transactions.get(id);
  }

  listTransactions(): readonly ConfigurationTransaction[] {
    return this.transactions.list();
  }
}
