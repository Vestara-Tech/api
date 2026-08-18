import type {
  VerificationControlPlane,
  VerificationRequest,
  VerificationPlan,
  VerificationVerdict,
  VerificationSourcePlan,
  VerificationSourceOutcome,
  VerificationConclusion,
  VerificationFreshness,
  VerificationReason,
} from '../domain/contracts.js';
import type { VerificationSource } from '../domain/ports.js';

/** DEX-CP4 — Policy configuration for VCTRL. */
export interface VctrlServiceOptions {
  readonly sources: readonly VerificationSource[];
  readonly freshnessWindowMs?: number;
}

/**
 * DEX-CP4 VCTRL-004 — Verification Control Plane service.
 *
 * The policy layer that:
 *   1. Routes verification requests to appropriate sources
 *   2. Aggregates source outcomes into a unified verdict
 *   3. Applies purpose-specific policies (developer-handoff, etc.)
 *   4. Classifies failure reasons (change vs baseline vs infrastructure)
 *
 * Does NOT:
 *   - Execute FASTVERIFY directly (delegates to sources)
 *   - Interpret verification reports (sources normalize those)
 *   - Make handoff decisions (derives them from verdict + freshness)
 */
export class VctrlService implements VerificationControlPlane {
  private readonly sources: readonly VerificationSource[];
  private readonly freshnessWindowMs: number;
  private readonly verdictHistory = new Map<string, { verdict: VerificationVerdict; timestamp: number }>();

  constructor(options: VctrlServiceOptions) {
    this.sources = options.sources;
    this.freshnessWindowMs = options.freshnessWindowMs ?? 5 * 60 * 1000; // 5 minutes default
  }

  /**
   * VCTRL-004 — Analyze a verification request.
   * Determines which sources need to run and at what level.
   */
  async analyze(request: VerificationRequest): Promise<VerificationPlan> {
    const sourcePlans: VerificationSourcePlan[] = [];

    for (const source of this.sources) {
      const plan = await source.analyze(request);
      sourcePlans.push(plan);
    }

    // Use the highest level across all sources.
    const levelOrder = ['V0', 'V1', 'V2', 'V3'];
    const highestLevel = sourcePlans.reduce(
      (max, p) => {
        const idx = levelOrder.indexOf(p.level);
        const maxIdx = levelOrder.indexOf(max);
        return idx > maxIdx ? p.level : max;
      },
      'V0',
    );

    return {
      request,
      sources: sourcePlans,
      level: highestLevel,
      reason: `VCTRL analysis: ${sourcePlans.length} source(s), highest level ${highestLevel}`,
    };
  }

  /**
   * VCTRL-004 — Execute a verification plan.
   * Runs all source plans and aggregates into a single verdict.
   */
  async execute(plan: VerificationPlan): Promise<VerificationVerdict> {
    const outcomes: VerificationSourceOutcome[] = [];

    for (const sourcePlan of plan.sources) {
      const source = this.sources.find((s) => s.id === sourcePlan.sourceId);
      if (!source) continue;

      const outcome = await source.execute(sourcePlan);
      outcomes.push(outcome);
    }

    return this.aggregateVerdict(plan.request, outcomes);
  }

  /**
   * VCTRL-004 — Verify in one step (analyze + execute).
   */
  async verify(request: VerificationRequest): Promise<VerificationVerdict> {
    const plan = await this.analyze(request);
    const verdict = await this.execute(plan);

    // Record verdict for freshness tracking.
    if (verdict.fingerprint) {
      this.verdictHistory.set(verdict.fingerprint, {
        verdict,
        timestamp: Date.now(),
      });
    }

    return verdict;
  }

  /**
   * VCTRL-007 — Check if a verdict is still fresh.
   */
  isFresh(verdict: VerificationVerdict): VerificationFreshness {
    if (!verdict.fingerprint) return 'stale';

    const record = this.verdictHistory.get(verdict.fingerprint);
    if (!record) return 'stale';

    const elapsed = Date.now() - record.timestamp;
    return elapsed <= this.freshnessWindowMs ? 'current' : 'stale';
  }

  /**
   * VCTRL-008 — Derive handoff eligibility from a verdict.
   * A completed developer runtime execution cannot become handoff-eligible
   * until VCTRL has produced a current PASS verdict.
   */
  deriveHandoffEligibility(verdict: VerificationVerdict): boolean {
    const freshness = this.isFresh(verdict);
    return verdict.conclusion === 'pass' && freshness === 'current';
  }

  private aggregateVerdict(
    request: VerificationRequest,
    outcomes: readonly VerificationSourceOutcome[],
  ): VerificationVerdict {
    // Aggregate conclusion: any FAIL → FAIL, any INDETERMINATE → INDETERMINATE, all PASS → PASS.
    let conclusion: VerificationConclusion = 'pass';
    for (const outcome of outcomes) {
      if (outcome.conclusion === 'fail') {
        conclusion = 'fail';
        break;
      }
      if (outcome.conclusion === 'indeterminate') {
        conclusion = 'indeterminate';
      }
    }

    // Aggregate freshness.
    const freshness: VerificationFreshness = 'current'; // Fresh for new verdicts.

    // Collect all affected modules.
    const affectedModules = [...new Set(outcomes.flatMap((o) => o.affectedModules))];

    // Collect evidence.
    const requiredEvidence = [...new Set(outcomes.flatMap((o) => o.requiredEvidence))];
    const satisfiedEvidence = [...new Set(outcomes.flatMap((o) => o.satisfiedEvidence))];
    const missingEvidence = [...new Set(outcomes.flatMap((o) => o.missingEvidence))];

    // Collect source references.
    const sources = outcomes.map((o) => ({
      sourceId: o.sourceId,
      level: o.level,
      result: o.conclusion,
      fingerprint: o.fingerprint,
      detail: o.detail,
    }));

    // Collect reasons.
    const reasons: VerificationReason[] = [...outcomes.flatMap((o) => o.reasons)];

    // Use the highest level across outcomes.
    const levelOrder = ['V0', 'V1', 'V2', 'V3'];
    const level = outcomes.reduce(
      (max, o) => {
        const idx = levelOrder.indexOf(o.level);
        const maxIdx = levelOrder.indexOf(max);
        return idx > maxIdx ? o.level : max;
      },
      'V0',
    );

    // Get fingerprint from the first outcome that has one.
    const fingerprint = outcomes.find((o) => o.fingerprint)?.fingerprint;

    return {
      purpose: request.purpose,
      conclusion,
      freshness,
      level,
      fingerprint,
      affectedModules,
      requiredEvidence,
      satisfiedEvidence,
      missingEvidence,
      sources,
      reasons,
    };
  }
}
