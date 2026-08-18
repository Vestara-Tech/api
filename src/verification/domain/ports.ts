import type {
  VerificationRequest,
  VerificationSourcePlan,
  VerificationSourceOutcome,
} from './contracts.js';

/**
 * DEX-CP4 VCTRL-002 — Verification source port.
 *
 * A verification source is any system that can analyze a request,
 * produce a plan, and execute verification. FASTVERIFY is source #1.
 * Later sources: Test Module, Browser, Diagnostics, CI, human evidence.
 */
export interface VerificationSource {
  readonly id: string;

  /**
   * Analyze a verification request and produce a source-specific plan.
   * This is the "what should I check?" phase.
   */
  analyze(request: VerificationRequest): Promise<VerificationSourcePlan>;

  /**
   * Execute a previously analyzed plan and produce an outcome.
   * This is the "run the checks" phase.
   */
  execute(plan: VerificationSourcePlan): Promise<VerificationSourceOutcome>;
}
