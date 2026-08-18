import type { VerificationSource } from '../domain/ports.js';
import type { VerificationSourcePlan, VerificationSourceOutcome, VerificationRequest } from '../domain/contracts.js';
import {
  runVerificationCommand,
  type VerificationReportSnapshot,
} from '../verification-service.js';

/**
 * DEX-CP4 VCTRL-003 — FastVerify adapter.
 *
 * Wraps the existing FASTVERIFY engine as a VerificationSource.
 * Does NOT rewrite, move, or duplicate FASTVERIFY logic.
 * FASTVERIFY remains responsible for:
 *   graph, ownership, impact, closure, test selection,
 *   fingerprint, execution, report.
 *
 * VCTRL interprets the result in the context of an execution purpose.
 */
export class FastVerifyAdapter implements VerificationSource {
  readonly id = 'fastverify';

  async analyze(request: VerificationRequest): Promise<VerificationSourcePlan> {
    const scope = this.mapPurposeToScope(request);

    return {
      sourceId: this.id,
      level: scope,
      reason: `FASTVERIFY analysis for purpose "${request.purpose}"`,
    };
  }

  async execute(plan: VerificationSourcePlan): Promise<VerificationSourceOutcome> {
    const result = runVerificationCommand({ scope: plan.level as 'static' | 'affected' | 'module' | 'platform' });

    if (!result.report) {
      return {
        sourceId: this.id,
        conclusion: 'indeterminate',
        level: plan.level,
        detail: 'FASTVERIFY produced no report',
        affectedModules: [],
        requiredEvidence: [],
        satisfiedEvidence: [],
        missingEvidence: ['verification-report'],
        reasons: [{
          kind: 'infrastructure-failure',
          message: 'FASTVERIFY produced no report output',
          source: this.id,
        }],
      };
    }

    return this.normalizeReport(result.report, plan.level);
  }

  private normalizeReport(
    report: VerificationReportSnapshot,
    requestedLevel: string,
  ): VerificationSourceOutcome {
    const conclusion = this.mapResultToConclusion(report.result);
    const hasBaselineFailures = this.detectBaselineFailures(report);

    const reasons: VerificationReason[] = [];

    if (report.result === 'fail' && hasBaselineFailures) {
      reasons.push({
        kind: 'baseline-failure',
        message: 'Pre-existing static verification failures detected',
        source: this.id,
      });
    }

    if (report.result === 'fail' && !hasBaselineFailures) {
      reasons.push({
        kind: 'change-failure',
        message: 'Verification failed due to changes in this execution',
        source: this.id,
      });
    }

    if (report.result === 'indeterminate') {
      reasons.push({
        kind: 'insufficient-evidence',
        message: 'Verification could not produce a definitive result',
        source: this.id,
      });
    }

    if (!report.verified) {
      reasons.push({
        kind: 'infrastructure-failure',
        message: `No tests executed (${report.executedTests.length} selected, ${report.cached} cached)`,
        source: this.id,
      });
    }

    const requiredEvidence: string[] = [];
    const satisfiedEvidence: string[] = [];
    const missingEvidence: string[] = [];

    if (report.evidence) {
      requiredEvidence.push('fingerprint');
      satisfiedEvidence.push('fingerprint');
    } else if (report.verified) {
      requiredEvidence.push('fingerprint');
      missingEvidence.push('fingerprint');
    }

    return {
      sourceId: this.id,
      conclusion,
      level: report.level,
      fingerprint: report.evidence ?? undefined,
      affectedModules: [...report.affectedModules],
      requiredEvidence,
      satisfiedEvidence,
      missingEvidence,
      detail: `FASTVERIFY: ${report.result} (${report.scope}, ${report.executedTests.length} tests, ${report.passed} passed, ${report.failed} failed)`,
      reasons,
    };
  }

  private mapResultToConclusion(result: string): 'pass' | 'fail' | 'indeterminate' {
    if (result === 'pass') return 'pass';
    if (result === 'fail') return 'fail';
    return 'indeterminate';
  }

  private mapPurposeToScope(request: VerificationRequest): string {
    switch (request.purpose) {
      case 'developer-handoff':
        return 'affected';
      case 'review':
        return 'affected';
      case 'final-verification':
        return 'platform';
      case 'ci':
        return 'platform';
      case 'manual':
        return 'affected';
      default:
        return 'affected';
    }
  }

  private detectBaselineFailures(report: VerificationReportSnapshot): boolean {
    if (report.result === 'fail' && report.executedTests.length === 0 && !report.verified) {
      return true;
    }
    if (report.result === 'fail' && report.escalated && report.level === 'V0') {
      return true;
    }
    return false;
  }
}

type VerificationReasonKind = 'change-failure' | 'baseline-failure' | 'infrastructure-failure' | 'insufficient-evidence' | 'policy-failure';

interface VerificationReason {
  readonly kind: VerificationReasonKind;
  readonly message: string;
  readonly source?: string;
}
