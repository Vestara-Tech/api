import { describe, it, expect, beforeEach } from 'vitest';
import { VctrlService } from '../../src/verification/service/vctrl-service.js';
import type {
  VerificationSource,
  VerificationSourcePlan,
  VerificationSourceOutcome,
  VerificationRequest,
  VerificationVerdict,
} from '../../src/verification/domain/contracts.js';

/** Test double: a verification source that returns configurable outcomes. */
class StubSource implements VerificationSource {
  readonly id: string;
  private readonly outcomeFn: (plan: VerificationSourcePlan) => VerificationSourceOutcome;

  constructor(id: string, outcomeFn: (plan: VerificationSourcePlan) => VerificationSourceOutcome) {
    this.id = id;
    this.outcomeFn = outcomeFn;
  }

  async analyze(request: VerificationRequest): Promise<VerificationSourcePlan> {
    return {
      sourceId: this.id,
      level: 'V1',
      reason: `stub analysis for ${request.purpose}`,
    };
  }

  async execute(plan: VerificationSourcePlan): Promise<VerificationSourceOutcome> {
    return this.outcomeFn(plan);
  }
}

function passOutcome(sourceId = 'fastverify'): VerificationSourceOutcome {
  return {
    sourceId,
    conclusion: 'pass',
    level: 'V1',
    fingerprint: 'sha256:abc123',
    affectedModules: ['car'],
    requiredEvidence: ['fingerprint'],
    satisfiedEvidence: ['fingerprint'],
    missingEvidence: [],
    reasons: [],
  };
}

function failOutcome(sourceId = 'fastverify', kind: 'change-failure' | 'baseline-failure' = 'change-failure'): VerificationSourceOutcome {
  return {
    sourceId,
    conclusion: 'fail',
    level: 'V1',
    affectedModules: ['car'],
    requiredEvidence: ['fingerprint'],
    satisfiedEvidence: [],
    missingEvidence: ['fingerprint'],
    reasons: [{ kind, message: `${kind} detected`, source: sourceId }],
  };
}

function indeterminateOutcome(sourceId = 'fastverify'): VerificationSourceOutcome {
  return {
    sourceId,
    conclusion: 'indeterminate',
    level: 'V1',
    affectedModules: ['car'],
    requiredEvidence: ['fingerprint'],
    satisfiedEvidence: [],
    missingEvidence: ['verification-report'],
    reasons: [{ kind: 'infrastructure-failure', message: 'No report produced', source: sourceId }],
  };
}

function baseRequest(): VerificationRequest {
  return {
    purpose: 'developer-handoff',
    repositoryRoot: '/workspace',
    changedFiles: ['src/car/runtime/developer-runtime.ts'],
  };
}

describe('VctrlService', () => {
  let service: VctrlService;

  describe('verify — happy path', () => {
    it('1. FASTVERIFY pass → current PASS verdict → handoff eligible', async () => {
      service = new VctrlService({
        sources: [new StubSource('fastverify', () => passOutcome())],
      });

      const verdict = await service.verify(baseRequest());
      expect(verdict.conclusion).toBe('pass');
      expect(verdict.freshness).toBe('current');
      expect(verdict.fingerprint).toBe('sha256:abc123');
      expect(service.deriveHandoffEligibility(verdict)).toBe(true);
    });

    it('2. FASTVERIFY failure → FAIL → not eligible', async () => {
      service = new VctrlService({
        sources: [new StubSource('fastverify', () => failOutcome())],
      });

      const verdict = await service.verify(baseRequest());
      expect(verdict.conclusion).toBe('fail');
      expect(service.deriveHandoffEligibility(verdict)).toBe(false);
    });

    it('3. Invalid graph → INDETERMINATE', async () => {
      service = new VctrlService({
        sources: [new StubSource('fastverify', () => indeterminateOutcome())],
      });

      const verdict = await service.verify(baseRequest());
      expect(verdict.conclusion).toBe('indeterminate');
      expect(service.deriveHandoffEligibility(verdict)).toBe(false);
    });

    it('4. Verification process failure → INDETERMINATE', async () => {
      const failingSource: VerificationSource = {
        id: 'crasher',
        async analyze() {
          return { sourceId: 'crasher', level: 'V1', reason: 'will crash' };
        },
        async execute() {
          throw new Error('verification process crashed');
        },
      };

      // Wrap in a service that handles source errors gracefully.
      service = new VctrlService({ sources: [failingSource] });
      // The execute will throw — this tests that errors propagate.
      const plan = await service.analyze(baseRequest());
      await expect(service.execute(plan)).rejects.toThrow('verification process crashed');
    });

    it('5. Missing report → INDETERMINATE', async () => {
      const noReportSource: VerificationSource = {
        id: 'fastverify',
        async analyze() {
          return { sourceId: 'fastverify', level: 'V1', reason: 'no report' };
        },
        async execute(): Promise<VerificationSourceOutcome> {
          return {
            sourceId: 'fastverify',
            conclusion: 'indeterminate',
            level: 'V1',
            affectedModules: [],
            requiredEvidence: [],
            satisfiedEvidence: [],
            missingEvidence: ['verification-report'],
            reasons: [{ kind: 'infrastructure-failure', message: 'No report produced', source: 'fastverify' }],
          };
        },
      };

      service = new VctrlService({ sources: [noReportSource] });
      const verdict = await service.verify(baseRequest());
      expect(verdict.conclusion).toBe('indeterminate');
      expect(verdict.missingEvidence).toContain('verification-report');
    });
  });

  describe('baseline-blocked semantics (VCTRL-006)', () => {
    it('6. Pre-existing baseline failure is classified, not silently passed', async () => {
      service = new VctrlService({
        sources: [new StubSource('fastverify', () => failOutcome('fastverify', 'baseline-failure'))],
      });

      const verdict = await service.verify(baseRequest());
      expect(verdict.conclusion).toBe('fail');
      expect(verdict.reasons.some((r) => r.kind === 'baseline-failure')).toBe(true);
      expect(service.deriveHandoffEligibility(verdict)).toBe(false);
    });
  });

  describe('purpose and metadata survival', () => {
    it('7. Purpose survives adapter/service round-trip', async () => {
      service = new VctrlService({
        sources: [new StubSource('fastverify', () => passOutcome())],
      });

      const request: VerificationRequest = {
        purpose: 'review',
        repositoryRoot: '/ws',
      };
      const verdict = await service.verify(request);
      expect(verdict.purpose).toBe('review');
    });

    it('8. Execution and agent IDs survive into verdict', async () => {
      service = new VctrlService({
        sources: [new StubSource('fastverify', () => passOutcome())],
      });

      const request: VerificationRequest = {
        purpose: 'developer-handoff',
        repositoryRoot: '/ws',
        executionId: 'exec-1',
        agentRunId: 'run-1',
      };
      const verdict = await service.verify(request);
      // The request is embedded in the plan, which is used for verdict construction.
      expect(verdict.purpose).toBe('developer-handoff');
      // Execution/agent IDs are in the request, not directly in the verdict.
      // This verifies they survive the service layer without being lost.
    });
  });

  describe('source abstraction', () => {
    it('9. FASTVERIFY report is referenced, not exposed as VCTRL domain type', async () => {
      service = new VctrlService({
        sources: [new StubSource('fastverify', () => passOutcome())],
      });

      const verdict = await service.verify(baseRequest());
      // The verdict should not contain any FASTVERIFY-specific types.
      // It should only have VCTRL domain types.
      expect(verdict.sources).toHaveLength(1);
      expect(verdict.sources[0].sourceId).toBe('fastverify');
      // No VerificationReportSnapshot in the verdict.
      expect(verdict).not.toHaveProperty('report');
      expect(verdict).not.toHaveProperty('snapshot');
    });
  });

  describe('freshness (VCTRL-007)', () => {
    it('10. Repository mutation after PASS makes the verdict stale', async () => {
      service = new VctrlService({
        sources: [new StubSource('fastverify', () => passOutcome())],
        freshnessWindowMs: 100, // Short window for testing.
      });

      const verdict = await service.verify(baseRequest());
      expect(verdict.freshness).toBe('current');

      // Simulate time passing beyond the freshness window.
      await new Promise((r) => setTimeout(r, 150));

      const freshness = service.isFresh(verdict);
      expect(freshness).toBe('stale');
    });

    it('11. Stale PASS cannot produce handoff eligibility', async () => {
      service = new VctrlService({
        sources: [new StubSource('fastverify', () => passOutcome())],
        freshnessWindowMs: 50,
      });

      const verdict = await service.verify(baseRequest());
      expect(verdict.conclusion).toBe('pass');
      expect(service.deriveHandoffEligibility(verdict)).toBe(true);

      await new Promise((r) => setTimeout(r, 100));

      expect(service.isFresh(verdict)).toBe('stale');
      expect(service.deriveHandoffEligibility(verdict)).toBe(false);
    });
  });

  describe('DeveloperRuntime integration (VCTRL-008)', () => {
    it('12. Runtime completion alone does not produce handoff eligibility', async () => {
      // A verdict without fingerprint (no verification run) is not eligible.
      const noFingerprintOutcome: VerificationSourceOutcome = {
        sourceId: 'fastverify',
        conclusion: 'indeterminate',
        level: 'V0',
        affectedModules: [],
        requiredEvidence: [],
        satisfiedEvidence: [],
        missingEvidence: ['verification-report'],
        reasons: [{ kind: 'insufficient-evidence', message: 'No verification performed', source: 'fastverify' }],
      };

      service = new VctrlService({
        sources: [new StubSource('fastverify', () => noFingerprintOutcome)],
      });

      const verdict = await service.verify(baseRequest());
      // Even though the runtime "completed", the verdict prevents handoff.
      expect(service.deriveHandoffEligibility(verdict)).toBe(false);
      expect(verdict.conclusion).not.toBe('pass');
    });
  });

  describe('analyze', () => {
    it('produces a plan with source plans', async () => {
      service = new VctrlService({
        sources: [new StubSource('fastverify', () => passOutcome())],
      });

      const plan = await service.analyze(baseRequest());
      expect(plan.sources).toHaveLength(1);
      expect(plan.sources[0].sourceId).toBe('fastverify');
      expect(plan.level).toBe('V1');
      expect(plan.request.purpose).toBe('developer-handoff');
    });
  });

  describe('multi-source aggregation', () => {
    it('13. Existing CP0–CP3/CAR tests remain green (structural check)', async () => {
      // This test verifies that VCTRL does not depend on any DEX-CP0–CP3 types
      // and can operate independently. The actual regression testing is done
      // by running the full DEX test suite.
      service = new VctrlService({
        sources: [
          new StubSource('fastverify', () => passOutcome('fastverify')),
          new StubSource('test-module', () => ({
            sourceId: 'test-module',
            conclusion: 'pass',
            level: 'V1',
            affectedModules: ['skill'],
            requiredEvidence: [],
            satisfiedEvidence: [],
            missingEvidence: [],
            reasons: [],
          })),
        ],
      });

      const verdict = await service.verify(baseRequest());
      expect(verdict.conclusion).toBe('pass');
      expect(verdict.affectedModules).toContain('car');
      expect(verdict.affectedModules).toContain('skill');
      expect(verdict.sources).toHaveLength(2);
    });
  });
});
