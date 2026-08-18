import { describe, it, expect } from 'vitest';
import { buildCodingExecutionEvidence } from '../../src/car/evidence/builder.js';
import { computeEvidenceHash } from '../../src/car/evidence/hash.js';
import type { CodingExecutionEvidenceInput, CodingExecutionEvidence } from '../../src/car/evidence/contracts.js';

function baseInput(overrides?: Partial<CodingExecutionEvidenceInput>): CodingExecutionEvidenceInput {
  return {
    outcome: 'completed',
    execution: { executionId: 'exec-1', agentRunId: 'run-1', objective: 'Build feature' },
    agent: { id: 'dev-1', role: 'developer' },
    runtime: { id: 'opencode', version: '1.0.0', sessionId: 'sess-1' },
    model: { providerId: 'openai', modelId: 'gpt-4' },
    repository: { baselineSha: 'abc123', headSha: 'def456', changedFiles: ['src/foo.ts', 'src/bar.ts'] },
    skills: [{ id: 'typescript-development', version: '1.0.0' }],
    tools: [{ id: 'read', granted: true, used: true }, { id: 'write', granted: true, used: false }],
    verification: { purpose: 'developer-handoff', conclusion: 'pass', freshness: 'current', fingerprint: 'sha256:abc', sourceEvidence: ['fastverify'] },
    timing: { startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T00:01:00Z' },
    ...overrides,
  };
}

describe('buildCodingExecutionEvidence', () => {
  it('1. Same normalized payload → same hash', () => {
    const input = baseInput();
    const e1 = buildCodingExecutionEvidence(input);
    const e2 = buildCodingExecutionEvidence(input);
    expect(e1.evidenceHash).toBe(e2.evidenceHash);
  });

  it('2. Different runtime → different hash', () => {
    const e1 = buildCodingExecutionEvidence(baseInput({ runtime: { id: 'opencode' } }));
    const e2 = buildCodingExecutionEvidence(baseInput({ runtime: { id: 'codex' } }));
    expect(e1.evidenceHash).not.toBe(e2.evidenceHash);
  });

  it('3. Different repository state → different hash', () => {
    const e1 = buildCodingExecutionEvidence(baseInput({ repository: { baselineSha: 'aaa' } }));
    const e2 = buildCodingExecutionEvidence(baseInput({ repository: { baselineSha: 'bbb' } }));
    expect(e1.evidenceHash).not.toBe(e2.evidenceHash);
  });

  it('4. Different VCTRL fingerprint → different hash', () => {
    const e1 = buildCodingExecutionEvidence(baseInput({ verification: { purpose: 'developer-handoff', conclusion: 'pass', freshness: 'current', fingerprint: 'sha256:aaa' } }));
    const e2 = buildCodingExecutionEvidence(baseInput({ verification: { purpose: 'developer-handoff', conclusion: 'pass', freshness: 'current', fingerprint: 'sha256:bbb' } }));
    expect(e1.evidenceHash).not.toBe(e2.evidenceHash);
  });

  it('5. Collection ordering does not alter the hash', () => {
    const input1 = baseInput({
      repository: { changedFiles: ['z.ts', 'a.ts', 'm.ts'] },
      skills: [{ id: 'z-skill', version: '1.0.0' }, { id: 'a-skill', version: '2.0.0' }],
      tools: [{ id: 'z-tool', granted: true, used: false }, { id: 'a-tool', granted: true, used: true }],
    });
    const input2 = baseInput({
      repository: { changedFiles: ['a.ts', 'm.ts', 'z.ts'] },
      skills: [{ id: 'a-skill', version: '2.0.0' }, { id: 'z-skill', version: '1.0.0' }],
      tools: [{ id: 'a-tool', granted: true, used: true }, { id: 'z-tool', granted: true, used: false }],
    });
    const e1 = buildCodingExecutionEvidence(input1);
    const e2 = buildCodingExecutionEvidence(input2);
    expect(e1.evidenceHash).toBe(e2.evidenceHash);
  });

  it('6. Current PASS derives handoffEligible=true', () => {
    const e = buildCodingExecutionEvidence(baseInput());
    expect(e.verification.handoffEligible).toBe(true);
  });

  it('7. Stale PASS derives false', () => {
    const e = buildCodingExecutionEvidence(baseInput({
      verification: { purpose: 'developer-handoff', conclusion: 'pass', freshness: 'stale', fingerprint: 'sha256:abc' },
    }));
    expect(e.verification.handoffEligible).toBe(false);
  });

  it('8. FAIL derives false', () => {
    const e = buildCodingExecutionEvidence(baseInput({
      verification: { purpose: 'developer-handoff', conclusion: 'fail', freshness: 'current', fingerprint: 'sha256:abc' },
    }));
    expect(e.verification.handoffEligible).toBe(false);
  });

  it('9. INDETERMINATE derives false', () => {
    const e = buildCodingExecutionEvidence(baseInput({
      verification: { purpose: 'developer-handoff', conclusion: 'indeterminate', freshness: 'current' },
    }));
    expect(e.verification.handoffEligible).toBe(false);
  });

  it('10. Runtime failure can still produce evidence', () => {
    const e = buildCodingExecutionEvidence(baseInput({
      outcome: 'failed',
      verification: { purpose: 'developer-handoff', conclusion: 'fail', freshness: 'current' },
    }));
    expect(e.outcome).toBe('failed');
    expect(e.verification.handoffEligible).toBe(false);
    expect(e.evidenceHash).toBeTruthy();
  });

  it('11. Cancelled execution can still produce evidence', () => {
    const e = buildCodingExecutionEvidence(baseInput({
      outcome: 'cancelled',
      verification: { purpose: 'developer-handoff', conclusion: 'fail', freshness: 'current' },
    }));
    expect(e.outcome).toBe('cancelled');
    expect(e.evidenceHash).toBeTruthy();
  });

  it('12. Evidence cannot claim handoff independently of VCTRL', () => {
    // Even with outcome=completed, handoff depends on verification.
    const e = buildCodingExecutionEvidence(baseInput({
      outcome: 'completed',
      verification: { purpose: 'developer-handoff', conclusion: 'fail', freshness: 'current' },
    }));
    expect(e.outcome).toBe('completed');
    expect(e.verification.handoffEligible).toBe(false);
  });

  it('13. FASTVERIFY report is referenced, not embedded', () => {
    const e = buildCodingExecutionEvidence(baseInput());
    // The evidence should not contain any FASTVERIFY-specific types.
    const serialized = JSON.stringify(e);
    expect(serialized).not.toContain('VerificationReportSnapshot');
    expect(serialized).not.toContain('graphValid');
    expect(serialized).not.toContain('escalated');
    // It should reference the fingerprint.
    expect(e.verification.fingerprint).toBe('sha256:abc');
  });

  it('14. No OpenCode SDK types appear in evidence contracts', () => {
    const e = buildCodingExecutionEvidence(baseInput());
    const serialized = JSON.stringify(e);
    expect(serialized).not.toContain('OpencodeClient');
    expect(serialized).not.toContain('createOpencode');
    expect(serialized).not.toContain('Session');
    // "opencode" as a runtime ID is fine — it's a string identifier.
    expect(e.runtime.id).toBe('opencode');
  });

  it('15. Evidence survives serialize → deserialize without semantic change', () => {
    const original = buildCodingExecutionEvidence(baseInput());
    const serialized = JSON.stringify(original);
    const deserialized = JSON.parse(serialized) as CodingExecutionEvidence;

    expect(deserialized.schemaVersion).toBe(original.schemaVersion);
    expect(deserialized.outcome).toBe(original.outcome);
    expect(deserialized.execution).toEqual(original.execution);
    expect(deserialized.agent).toEqual(original.agent);
    expect(deserialized.runtime).toEqual(original.runtime);
    expect(deserialized.model).toEqual(original.model);
    expect(deserialized.repository).toEqual(original.repository);
    expect(deserialized.skills).toEqual(original.skills);
    expect(deserialized.tools).toEqual(original.tools);
    expect(deserialized.verification).toEqual(original.verification);
    expect(deserialized.timing).toEqual(original.timing);
    expect(deserialized.evidenceHash).toBe(original.evidenceHash);
  });
});

describe('computeEvidenceHash', () => {
  it('produces consistent results for identical payloads', () => {
    const evidence = buildCodingExecutionEvidence(baseInput());
    const h1 = computeEvidenceHash(evidence);
    const h2 = computeEvidenceHash(evidence);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('excludes evidenceHash from computation', () => {
    const e1 = buildCodingExecutionEvidence(baseInput());
    // Manually change the hash — recomputation should produce the original hash.
    const tampered = { ...e1, evidenceHash: 'sha256:tampered' } as CodingExecutionEvidence;
    const recomputed = computeEvidenceHash(tampered);
    expect(recomputed).toBe(e1.evidenceHash);
  });
});

describe('validation', () => {
  it('rejects empty executionId', () => {
    expect(() => buildCodingExecutionEvidence(baseInput({
      execution: { executionId: '', agentRunId: 'run-1' },
    }))).toThrow('executionId is required');
  });

  it('rejects empty agent id', () => {
    expect(() => buildCodingExecutionEvidence(baseInput({
      agent: { id: '', role: 'developer' },
    }))).toThrow('agent.id is required');
  });

  it('rejects negative duration', () => {
    expect(() => buildCodingExecutionEvidence(baseInput({
      timing: { startedAt: '2026-01-01T01:00:00Z', completedAt: '2026-01-01T00:00:00Z' },
    }))).toThrow('timing.completedAt must be after timing.startedAt');
  });
});
