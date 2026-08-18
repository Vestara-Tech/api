import { describe, it, expect } from 'vitest';
import { normalizeEvent, normalizeEvents, isInternalEvent } from '../../src/activity-room/projection/event-normalizer.js';
import { classifyComplexity } from '../../src/activity-room/projection/complexity-classifier.js';
import { shouldProduceMessage, toConversationMessage, filterConversationMessages } from '../../src/activity-room/projection/conversation-filter.js';
import { buildProjection } from '../../src/activity-room/projection/execution-projection.js';
import type { ExecutionRecord, CoordinatorResult } from '../../src/activity-room/projection/execution-projection.js';

// ── Event Normalization (ARX-005) ─────────────────────────────────

describe('ARX-CP1 event normalization', () => {
  it('maps requested event to timeline event', () => {
    const result = normalizeEvent({ type: 'requested', at: '2026-01-01T00:00:00Z', detail: 'Build feature' });
    expect(result).toBeDefined();
    expect(result!.kind).toBe('execution-requested');
    expect(result!.status).toBe('info');
  });

  it('maps execution-completed to success', () => {
    const result = normalizeEvent({ type: 'execution-completed', at: '2026-01-01T00:00:00Z' });
    expect(result).toBeDefined();
    expect(result!.status).toBe('success');
  });

  it('maps execution-failed to error', () => {
    const result = normalizeEvent({ type: 'execution-failed', at: '2026-01-01T00:00:00Z', detail: 'timeout' });
    expect(result).toBeDefined();
    expect(result!.status).toBe('error');
    expect(result!.detail).toBe('timeout');
  });

  it('maps tool-requested to warning (approval required)', () => {
    const result = normalizeEvent({ type: 'tool-requested', at: '2026-01-01T00:00:00Z', name: 'write' });
    expect(result).toBeDefined();
    expect(result!.kind).toBe('tool-approval-required');
    expect(result!.status).toBe('warning');
  });

  it('maps file-changed to change-detected', () => {
    const result = normalizeEvent({ type: 'file-changed', at: '2026-01-01T00:00:00Z', path: 'src/index.ts' });
    expect(result).toBeDefined();
    expect(result!.kind).toBe('change-detected');
    expect(result!.title).toContain('src/index.ts');
  });

  it('returns null for internal noise events', () => {
    expect(normalizeEvent({ type: 'thinking', at: '2026-01-01T00:00:00Z' })).toBeNull();
    expect(normalizeEvent({ type: 'usage', at: '2026-01-01T00:00:00Z' })).toBeNull();
    expect(normalizeEvent({ type: 'tool-started', at: '2026-01-01T00:00:00Z' })).toBeNull();
    expect(normalizeEvent({ type: 'tool-completed', at: '2026-01-01T00:00:00Z' })).toBeNull();
    expect(normalizeEvent({ type: 'reasoning', at: '2026-01-01T00:00:00Z' })).toBeNull();
  });

  it('normalizeEvents filters noise and preserves order', () => {
    const events = [
      { type: 'requested', at: '2026-01-01T00:00:00Z' },
      { type: 'thinking', at: '2026-01-01T00:00:01Z' },
      { type: 'execution-started', at: '2026-01-01T00:00:02Z' },
      { type: 'usage', at: '2026-01-01T00:00:03Z' },
      { type: 'execution-completed', at: '2026-01-01T00:00:04Z' },
    ];
    const result = normalizeEvents(events);
    expect(result).toHaveLength(3);
    expect(result[0].kind).toBe('execution-requested');
    expect(result[1].kind).toBe('execution-started');
    expect(result[2].kind).toBe('execution-completed');
  });

  it('isInternalEvent identifies noise', () => {
    expect(isInternalEvent('thinking')).toBe(true);
    expect(isInternalEvent('usage')).toBe(true);
    expect(isInternalEvent('tool-started')).toBe(true);
    expect(isInternalEvent('requested')).toBe(false);
    expect(isInternalEvent('execution-started')).toBe(false);
    expect(isInternalEvent('file-changed')).toBe(false);
  });
});

// ── Complexity Classification (ARX-004) ───────────────────────────

describe('ARX-CP1 complexity classification', () => {
  it('classifies simple goals', () => {
    const result = classifyComplexity('Print hello world');
    expect(result.level).toBe('simple');
    expect(result.estimatedAgents).toEqual(['developer']);
  });

  it('classifies simple status goals', () => {
    const result = classifyComplexity('Show the current DEX runtime status');
    expect(result.level).toBe('simple');
  });

  it('classifies standard goals', () => {
    const result = classifyComplexity('Add a CLI command for status');
    expect(result.level).toBe('standard');
    expect(result.estimatedAgents).toContain('planner');
    expect(result.estimatedAgents).toContain('developer');
    expect(result.estimatedAgents).toContain('verifier');
  });

  it('classifies complex goals', () => {
    const result = classifyComplexity('Build the Theme Builder');
    expect(result.level).toBe('complex');
    expect(result.estimatedAgents).toContain('reviewer');
  });

  it('defaults to standard for ambiguous goals', () => {
    const result = classifyComplexity('Do the thing');
    expect(result.level).toBe('standard');
  });

  it('classifies create a component as standard', () => {
    const result = classifyComplexity('Create a component for status display');
    expect(result.level).toBe('standard');
  });
});

// ── Conversation Filtering (ARX-006) ──────────────────────────────

describe('ARX-CP1 conversation filtering', () => {
  it('shouldProduceMessage returns true for conversation-worthy events', () => {
    expect(shouldProduceMessage('requested')).toBe(true);
    expect(shouldProduceMessage('execution-started')).toBe(true);
    expect(shouldProduceMessage('execution-completed')).toBe(true);
    expect(shouldProduceMessage('execution-failed')).toBe(true);
    expect(shouldProduceMessage('file-changed')).toBe(true);
  });

  it('shouldProduceMessage returns false for noise events', () => {
    expect(shouldProduceMessage('thinking')).toBe(false);
    expect(shouldProduceMessage('usage')).toBe(false);
    expect(shouldProduceMessage('tool-started')).toBe(false);
    expect(shouldProduceMessage('tool-completed')).toBe(false);
  });

  it('toConversationMessage creates message from event', () => {
    const msg = toConversationMessage('execution-completed', '3 files changed', undefined, '2026-01-01T00:00:00Z');
    expect(msg).toBeDefined();
    expect(msg!.role).toBe('assistant');
    expect(msg!.text).toContain('3 files changed');
    expect(msg!.kind).toBe('completed');
  });

  it('toConversationMessage returns null for noise', () => {
    expect(toConversationMessage('thinking')).toBeNull();
    expect(toConversationMessage('usage')).toBeNull();
  });

  it('filterConversationMessages deduplicates by kind', () => {
    const events = [
      { type: 'file-changed', at: '2026-01-01T00:00:00Z', detail: 'a.ts' },
      { type: 'file-changed', at: '2026-01-01T00:00:01Z', detail: 'b.ts' },
      { type: 'execution-completed', at: '2026-01-01T00:00:02Z' },
    ];
    const msgs = filterConversationMessages(events);
    // Only one message for file-changed (deduplicated by kind)
    expect(msgs.filter((m) => m.kind === 'changes-made')).toHaveLength(1);
    expect(msgs.filter((m) => m.kind === 'completed')).toHaveLength(1);
  });

  it('filterConversationMessages filters noise events', () => {
    const events = [
      { type: 'thinking', at: '2026-01-01T00:00:00Z' },
      { type: 'usage', at: '2026-01-01T00:00:01Z' },
      { type: 'requested', at: '2026-01-01T00:00:02Z' },
    ];
    const msgs = filterConversationMessages(events);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].kind).toBe('goal-stated');
  });
});

// ── Projection Builder (ARX-002/003/005/006/007) ──────────────────

describe('ARX-CP1 projection builder', () => {
  const baseExecution: ExecutionRecord = {
    id: 'exec-1',
    status: 'planning',
    request: { goal: 'Add a CLI command for DEX status', agentId: 'vestara-developer', roomId: 'activity-room' },
    events: [
      { id: 'e1', type: 'requested', at: '2026-01-01T00:00:00Z', detail: 'Add a CLI command' },
      { id: 'e2', type: 'intent-resolved', at: '2026-01-01T00:00:01Z', detail: 'standard' },
      { id: 'e3', type: 'plan-composed', at: '2026-01-01T00:00:02Z' },
    ],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:02Z',
  };

  const completedResult: CoordinatorResult = {
    executionId: 'exec-1',
    agentId: 'vestara-developer',
    outcome: 'completed',
    runtimeId: 'opencode',
    sessionId: 'opencode:ses_123',
    changedFiles: ['src/cli/status.ts', 'tests/cli/status.test.ts'],
    verification: {
      conclusion: 'pass',
      freshness: 'current',
      level: 'V1',
      affectedModules: ['cli'],
      fingerprint: 'sha256:abc123',
    },
    handoffEligible: true,
    evidence: {
      evidenceHash: 'sha256:def456',
      outcome: 'completed',
      skills: [{ id: 'typescript-development' }],
      tools: [
        { id: 'read', granted: true, used: true },
        { id: 'write', granted: true, used: true },
      ],
    },
    events: [
      { type: 'execution-started', at: '2026-01-01T00:00:03Z' },
      { type: 'context-assembled', at: '2026-01-01T00:00:04Z' },
      { type: 'runtime-connected', at: '2026-01-01T00:00:05Z' },
      { type: 'file-changed', at: '2026-01-01T00:00:06Z', path: 'src/cli/status.ts' },
      { type: 'file-changed', at: '2026-01-01T00:00:07Z', path: 'tests/cli/status.test.ts' },
      { type: 'execution-completed', at: '2026-01-01T00:00:08Z', detail: '2 files changed' },
    ],
    context: {
      identity: { agentId: 'vestara-developer' },
      governance: { skills: [{ id: 'typescript-development' }] },
    },
  };

  it('builds projection from execution record only (reconnect case)', () => {
    const projection = buildProjection(baseExecution);
    expect(projection.executionId).toBe('exec-1');
    expect(projection.goal).toBe('Add a CLI command for DEX status');
    expect(projection.status).toBe('planning');
    expect(projection.phase).toBe('planning');
    expect(projection.complexity).toBe('standard');
    expect(projection.runtime).toBeUndefined();
    expect(projection.evidence).toBeUndefined();
    expect(projection.verification.status).toBe('pending');
    expect(projection.verification.handoffEligible).toBe(false);
  });

  it('builds projection with coordinator result', () => {
    const projection = buildProjection(baseExecution, completedResult);
    expect(projection.status).toBe('completed');
    expect(projection.phase).toBe('completed');
    expect(projection.runtime).toBeDefined();
    expect(projection.runtime!.id).toBe('opencode');
    expect(projection.runtime!.sessionId).toBe('opencode:ses_123');
    expect(projection.verification.conclusion).toBe('pass');
    expect(projection.verification.freshness).toBe('current');
    expect(projection.verification.handoffEligible).toBe(true);
    expect(projection.evidence).toBeDefined();
    expect(projection.evidence!.hash).toBe('sha256:def456');
    expect(projection.changes.fileCount).toBe(2);
  });

  it('PASS/current is visually distinct from PASS/stale', () => {
    const currentProj = buildProjection(baseExecution, {
      ...completedResult,
      verification: { ...completedResult.verification, freshness: 'current' },
    });
    const staleProj = buildProjection(baseExecution, {
      ...completedResult,
      verification: { ...completedResult.verification, freshness: 'stale' },
    });
    expect(currentProj.verification.freshness).toBe('current');
    expect(currentProj.verification.handoffEligible).toBe(true);
    expect(staleProj.verification.freshness).toBe('stale');
    expect(staleProj.verification.handoffEligible).toBe(false);
  });

  it('FAIL verdict produces correct projection', () => {
    const failResult: CoordinatorResult = {
      ...completedResult,
      verification: {
        conclusion: 'fail',
        freshness: 'current',
        level: 'V1',
        affectedModules: ['cli'],
      },
      handoffEligible: false,
    };
    const projection = buildProjection(baseExecution, failResult);
    expect(projection.verification.status).toBe('failed');
    expect(projection.verification.conclusion).toBe('fail');
    expect(projection.verification.handoffEligible).toBe(false);
  });

  it('INDETERMINATE verdict produces correct projection', () => {
    const indeterminateResult: CoordinatorResult = {
      ...completedResult,
      verification: {
        conclusion: 'indeterminate',
        freshness: 'current',
      },
      handoffEligible: false,
    };
    const projection = buildProjection(baseExecution, indeterminateResult);
    expect(projection.verification.status).toBe('indeterminate');
    expect(projection.verification.conclusion).toBe('indeterminate');
    expect(projection.verification.handoffEligible).toBe(false);
  });

  it('projection is deterministic — same inputs produce same output', () => {
    const p1 = buildProjection(baseExecution, completedResult);
    const p2 = buildProjection(baseExecution, completedResult);
    expect(p1.executionId).toBe(p2.executionId);
    expect(p1.phase).toBe(p2.phase);
    expect(p1.complexity).toBe(p2.complexity);
    expect(p1.verification.conclusion).toBe(p2.verification.conclusion);
    expect(p1.evidence?.hash).toBe(p2.evidence?.hash);
  });

  it('no raw OpenCode events leak into projection', () => {
    const projection = buildProjection(baseExecution, completedResult);
    const timelineKinds = projection.timeline.map((e) => e.kind);

    // None of these should appear.
    expect(timelineKinds).not.toContain('thinking');
    expect(timelineKinds).not.toContain('usage');
    expect(timelineKinds).not.toContain('tool-started');
    expect(timelineKinds).not.toContain('tool-completed');
    expect(timelineKinds).not.toContain('reasoning');
    expect(timelineKinds).not.toContain('step-start');
    expect(timelineKinds).not.toContain('step-finish');

    // These should appear.
    expect(timelineKinds).toContain('execution-started');
    expect(timelineKinds).toContain('execution-completed');
  });

  it('conversation messages are human-oriented', () => {
    const projection = buildProjection(baseExecution, completedResult);
    const messageTexts = projection.messages.map((m) =>
      m.parts.map((p) => String(p.content)).join(' '),
    );

    // Should have meaningful messages.
    expect(messageTexts.some((t) => t.includes('Starting') || t.includes('Connected'))).toBe(true);
    expect(messageTexts.some((t) => t.includes('complete') || t.includes('Complete'))).toBe(true);

    // Should NOT have raw noise.
    expect(messageTexts.some((t) => t.includes('Reading file'))).toBe(false);
    expect(messageTexts.some((t) => t.includes('Calling tool'))).toBe(false);
    expect(messageTexts.some((t) => t.includes('token'))).toBe(false);
  });

  it('cancelled execution produces correct projection', () => {
    const cancelledExecution: ExecutionRecord = {
      ...baseExecution,
      status: 'cancelled',
    };
    const projection = buildProjection(cancelledExecution);
    expect(projection.status).toBe('cancelled');
    expect(projection.phase).toBe('failed');
  });

  it('failed execution produces correct projection', () => {
    const failedResult: CoordinatorResult = {
      ...completedResult,
      outcome: 'failed',
      verification: {
        conclusion: 'indeterminate',
        freshness: 'current',
      },
      handoffEligible: false,
      evidence: undefined,
    };
    const projection = buildProjection(baseExecution, failedResult);
    expect(projection.phase).toBe('failed');
    expect(projection.evidence).toBeUndefined();
  });

  it('participants show agent status correctly', () => {
    const runningResult: CoordinatorResult = {
      ...completedResult,
      outcome: 'running',
      verification: { ...completedResult.verification, conclusion: 'indeterminate' },
      handoffEligible: false,
      evidence: undefined,
    };
    const projection = buildProjection(baseExecution, runningResult);
    expect(projection.participants).toHaveLength(1);
    expect(projection.participants[0].status).toBe('active');
    expect(projection.participants[0].agentId).toBe('vestara-developer');
  });
});
