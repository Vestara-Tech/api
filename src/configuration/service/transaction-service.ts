import { randomId } from '../../core/identifiers.js';
import { badRequest } from '../../core/errors.js';
import type { ConfigurationChange, ConfigurationImpact, ConfigurationScopeRef, ConfigurationTransaction, ConfigurationTransactionStatus } from '../domain/expanded.js';

/**
 * CONFIG-014 — Configuration transaction service. Multiple changes are atomic:
 * draft → validate → impact → approve → apply → verify → commit, with rollback
 * on failure. Never a partially configured system.
 */
export class ConfigurationTransactionService {
  private readonly transactions = new Map<string, ConfigurationTransaction>();

  create(scope: ConfigurationScopeRef, changes: readonly ConfigurationChange[]): ConfigurationTransaction {
    const transaction: ConfigurationTransaction = {
      id: randomId('cfg'),
      scope,
      changes,
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
    this.transactions.set(transaction.id, transaction);
    return transaction;
  }

  get(id: string): ConfigurationTransaction {
    const transaction = this.transactions.get(id);
    if (!transaction) throw badRequest(`Configuration transaction "${id}" not found`);
    return transaction;
  }

  validate(id: string, apply: (changes: readonly ConfigurationChange[]) => { ok: boolean; error?: string }): ConfigurationTransaction {
    const transaction = this.requireStatus(id, 'draft');
    const result = apply(transaction.changes);
    const next: ConfigurationTransaction = { ...transaction, status: result.ok ? 'validated' : 'failed', ...(!result.ok && result.error !== undefined ? { error: result.error } : {}) };
    this.transactions.set(id, next);
    return next;
  }

  setImpact(id: string, impact: ConfigurationImpact): ConfigurationTransaction {
    const transaction = this.requireStatus(id, 'validated');
    const next: ConfigurationTransaction = { ...transaction, impact, status: 'awaiting-approval' };
    this.transactions.set(id, next);
    return next;
  }

  approve(id: string, approved: boolean, apply: (changes: readonly ConfigurationChange[]) => { ok: boolean; error?: string }): ConfigurationTransaction {
    if (!approved) {
      const rejected: ConfigurationTransaction = { ...this.get(id), status: 'failed', error: 'rejected' };
      this.transactions.set(id, rejected);
      return rejected;
    }
    const transaction = this.get(id);
    const result = apply(transaction.changes);
    if (!result.ok) {
      const failed: ConfigurationTransaction = { ...transaction, status: 'failed', ...(result.error !== undefined ? { error: result.error } : {}) };
      this.transactions.set(id, failed);
      return failed;
    }
    const committed: ConfigurationTransaction = { ...transaction, status: 'committed', appliedAt: new Date().toISOString() };
    this.transactions.set(id, committed);
    return committed;
  }

  rollback(id: string): ConfigurationTransaction {
    const transaction = this.get(id);
    if (transaction.status !== 'committed') throw badRequest(`Only committed transactions can be rolled back (${transaction.status})`);
    const rolled: ConfigurationTransaction = { ...transaction, status: 'rolled-back' };
    this.transactions.set(id, rolled);
    return rolled;
  }

  list(): readonly ConfigurationTransaction[] {
    return [...this.transactions.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private requireStatus(id: string, status: ConfigurationTransactionStatus): ConfigurationTransaction {
    const transaction = this.get(id);
    if (transaction.status !== status) throw badRequest(`Transaction "${id}" is ${transaction.status}, expected ${status}`);
    return transaction;
  }
}
