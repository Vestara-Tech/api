import { notFound } from '../core/errors.js';
import type { DiagnosticContribution } from './contracts.js';

/**
 * DIAG-003 — Diagnostics registry. Every module contributes diagnostic checks;
 * Diagnostics never imports each module.
 */
export class DiagnosticRegistry {
  private readonly contributions = new Map<string, DiagnosticContribution>();

  register(contribution: DiagnosticContribution): void {
    this.contributions.set(contribution.id, contribution);
  }

  get(id: string): DiagnosticContribution {
    const contribution = this.contributions.get(id);
    if (!contribution) throw notFound(`Diagnostic contribution "${id}" not found`);
    return contribution;
  }

  list(): readonly DiagnosticContribution[] {
    return [...this.contributions.values()].sort((a, b) => a.moduleId.localeCompare(b.moduleId));
  }

  listChecks(): readonly { checkId: string; name: string; category: string; risk: string; moduleId: string }[] {
    return this.list().flatMap((c) => c.checks.map((check) => ({ checkId: check.id, name: check.name, category: check.category, risk: check.risk, moduleId: c.moduleId })));
  }
}
