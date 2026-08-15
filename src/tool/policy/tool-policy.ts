import type { ToolAuthorizationDecision, ToolRisk } from '../domain/contracts.js';

export interface ToolPolicyOptions {
  readonly autoApproveRisks?: readonly ToolRisk[];
  readonly denyRisks?: readonly ToolRisk[];
}

/**
 * TOOL-005 — Tool risk policy. Maps tool risk to an authorization decision:
 * read/write may auto-approve; control/privileged/critical require approval or
 * are denied by policy. AI never bypasses the capability policy.
 */
export class ToolPolicy {
  private readonly autoApproveRisks: ReadonlySet<ToolRisk>;
  private readonly denyRisks: ReadonlySet<ToolRisk>;

  constructor(options: ToolPolicyOptions = {}) {
    this.autoApproveRisks = new Set(options.autoApproveRisks ?? ['read', 'write']);
    this.denyRisks = new Set(options.denyRisks ?? []);
  }

  evaluate(risk: ToolRisk, hasCapability: boolean): ToolAuthorizationDecision {
    if (!hasCapability) {
      return { allowed: false, approvalRequired: false, reason: 'principal lacks the required capability' };
    }
    if (this.denyRisks.has(risk)) {
      return { allowed: false, approvalRequired: false, reason: `risk "${risk}" is denied by policy` };
    }
    if (this.autoApproveRisks.has(risk)) {
      return { allowed: true, approvalRequired: false, reason: `risk "${risk}" auto-approved by policy` };
    }
    return { allowed: false, approvalRequired: true, reason: `risk "${risk}" requires human approval` };
  }
}
