import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { FileActivityHistoryStore, InMemoryActivityHistoryStore } from '../../src/activity-room/history/store.js';
import { ActivityHistoryRecorderImpl } from '../../src/activity-room/history/recorder.js';
import { recoverExecution, recoverEvents } from '../../src/activity-room/history/recovery.js';
import type { ActivityExecutionFact, ActivityHistoryStore } from '../../src/activity-room/history/contracts.js';
import type { ExecutionRecord, CoordinatorResult } from '../../src/activity-room/projection/execution-projection.js';

const createdDirs: string[] = [];

afterEach(() => {
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop();
    if (!dir) continue;
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempFile(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  createdDirs.push(dir);
  return join(dir, 'history.json');
}

function buildExecution(id: string): ExecutionRecord {
  return {
    id,
    status: 'planning',
    request: {
      goal: 'Add a CLI command that shows DEX runtime status',
      agentId: 'vestara-developer',
      roomId: 'activity-room',
    },
    events: [],
    createdAt: '2026-08-18T10:00:00.000Z',
    updatedAt: '2026-08-18T10:00:00.000Z',
  };
}

function buildCoordinatorResult(executionId: string): CoordinatorResult {
  return {
    executionId,
    agentId: 'vestara-developer',
    outcome: 'completed',
    runtimeId: 'opencode',
    sessionId: 'opencode:ses_x',
    changedFiles: ['src/cli.ts', 'tests/cli.test.ts'],
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
      tools: [{ id: 'write', granted: true, used: true }],
    },
    events: [
      { type: 'verification-started', at: '2026-08-18T10:01:00.000Z' },
      { type: 'verification-completed', at: '2026-08-18T10:01:05.000Z' },
      { type: 'evidence-recorded', at: '2026-08-18T10:01:06.000Z' },
      { type: 'file-changed', at: '2026-08-18T10:01:07.000Z', path: 'src/cli.ts' },
      { type: 'file-changed', at: '2026-08-18T10:01:08.000Z', path: 'tests/cli.test.ts' },
      { type: 'execution-completed', at: '2026-08-18T10:01:09.000Z' },
    ],
  };
}

// ── Deterministic ordering ─────────────────────────────────────────

describe('ARX-011 event sequencing', () => {
  it('assigns monotonically increasing per-execution sequence', () => {
    const store = new InMemoryActivityHistoryStore();
    const executionId = 'exec_seq';

    store.appendEvent({ executionId, occurredAt: '2026-08-18T10:00:01Z', type: 'execution-requested', payload: { goal: 'g', agentId: 'a', roomId: 'r', complexity: 'simple' } });
    store.appendEvent({ executionId, occurredAt: '2026-08-18T10:00:02Z', type: 'file-changed', payload: { path: 'a.ts' } });
    store.appendEvent({ executionId, occurredAt: '2026-08-18T10:00:03Z', type: 'execution-completed', payload: { outcome: 'completed', changedFiles: [], handoffEligible: true } });

    const events = store.events(executionId);
    expect(events.map((e) => e.sequence)).toEqual([1, 2, 3]);
    expect(events[0]?.type).toBe('execution-requested');
    expect(events[2]?.type).toBe('execution-completed');
  });

  it('keeps a separate sequence counter per execution', () => {
    const store = new InMemoryActivityHistoryStore();
    store.appendEvent({ executionId: 'a', occurredAt: '2026-08-18T10:00:01Z', type: 'execution-requested', payload: { goal: 'g', agentId: 'a', roomId: 'r', complexity: 'simple' } });
    store.appendEvent({ executionId: 'b', occurredAt: '2026-08-18T10:00:01Z', type: 'execution-requested', payload: { goal: 'g', agentId: 'a', roomId: 'r', complexity: 'simple' } });

    expect(store.events('a')[0]?.sequence).toBe(1);
    expect(store.events('b')[0]?.sequence).toBe(1);
    expect(store.nextSequence('a')).toBe(2);
  });

  it('returns events after a cursor', () => {
    const store = new InMemoryActivityHistoryStore();
    const executionId = 'exec_cursor';
    for (let i = 0; i < 5; i += 1) {
      store.appendEvent({ executionId, occurredAt: `2026-08-18T10:00:0${i}Z`, type: 'file-changed', payload: { path: `f${i}.ts` } });
    }

    const after = store.events(executionId, 3);
    expect(after.map((e) => e.sequence)).toEqual([4, 5]);
    expect(after.map((e) => e.payload.path)).toEqual(['f3.ts', 'f4.ts']);
  });

  it('suppresses duplicate events by deterministic id', () => {
    const store = new InMemoryActivityHistoryStore();
    const executionId = 'exec_dup';
    const input = { executionId, occurredAt: '2026-08-18T10:00:00Z', type: 'file-changed' as const, payload: { path: 'a.ts' } };

    const first = store.appendEvent(input);
    const second = store.appendEvent(input);

    expect(second.id).toBe(first.id);
    expect(store.events(executionId)).toHaveLength(1);
  });
});

// ── Durable restart recovery ───────────────────────────────────────

describe('ARX-011 durable history', () => {
  it('persists facts and events across store instances (restart)', () => {
    const filePath = makeTempFile('vestara-activity-history-');
    const execution = buildExecution('exec_restart');

    const first = new FileActivityHistoryStore(filePath);
    const recorder = new ActivityHistoryRecorderImpl(first);
    const fact = recorder.recordCoordinatorResult({
      execution,
      result: buildCoordinatorResult('exec_restart'),
    });
    expect(fact.status).toBe('completed');
    expect(fact.evidenceHash).toBe('sha256:def456');
    expect(first.events('exec_restart')).toHaveLength(9);

    // Simulate process restart — new store instance over the same file.
    const second = new FileActivityHistoryStore(filePath);
    const recovered = recoverExecution(second, 'exec_restart');

    expect(recovered).not.toBeNull();
    expect(recovered!.fact.executionId).toBe('exec_restart');
    expect(recovered!.fact.status).toBe('completed');
    expect(recovered!.fact.verificationFingerprint).toBe('sha256:abc123');
    expect(recovered!.fact.evidenceHash).toBe('sha256:def456');
    expect(recovered!.fact.runtimeSessionId).toBe('opencode:ses_x');
    expect(recovered!.projection.status).toBe('completed');
    expect(recovered!.projection.verification.conclusion).toBe('pass');
    expect(recovered!.projection.verification.freshness).toBe('current');
    expect(recovered!.projection.verification.handoffEligible).toBe(true);
    expect(recovered!.projection.evidence?.hash).toBe('sha256:def456');
    expect(recovered!.projection.changes.fileCount).toBe(2);
    expect(recovered!.projection.changes.files.map((f) => f.path)).toEqual(['src/cli.ts', 'tests/cli.test.ts']);
  });

  it('persists records across a second restart with same sequences', () => {
    const filePath = makeTempFile('vestara-activity-history-');
    const executionId = 'exec_restart2';
    const store = new FileActivityHistoryStore(filePath);
    store.upsertExecution({
      executionId,
      roomId: 'activity-room',
      goal: 'g',
      agentId: 'a',
      complexity: 'simple',
      participants: [],
      status: 'completed',
      createdAt: '2026-08-18T10:00:00Z',
      updatedAt: '2026-08-18T10:00:10Z',
    });
    store.appendEvent({ executionId, occurredAt: '2026-08-18T10:00:01Z', type: 'execution-requested', payload: { goal: 'g', agentId: 'a', roomId: 'r', complexity: 'simple' } });
    store.appendEvent({ executionId, occurredAt: '2026-08-18T10:00:02Z', type: 'execution-completed', payload: { outcome: 'completed', changedFiles: [], handoffEligible: true } });

    const reloaded = new FileActivityHistoryStore(filePath);
    expect(reloaded.events(executionId).map((e) => e.sequence)).toEqual([1, 2]);
    expect(reloaded.getExecution(executionId)?.status).toBe('completed');
  });

  it('handles a missing execution as null on recovery', () => {
    const store = new InMemoryActivityHistoryStore();
    expect(recoverExecution(store, 'does-not-exist')).toBeNull();
    expect(recoverEvents(store, 'does-not-exist')).toEqual([]);
  });

  it('returns an in-progress execution without a coordinator result', () => {
    const store = new InMemoryActivityHistoryStore();
    const execution = buildExecution('exec_inflight');
    new ActivityHistoryRecorderImpl(store).recordExecution({ execution });

    const recovered = recoverExecution(store, 'exec_inflight');
    expect(recovered).not.toBeNull();
    expect(recovered!.fact.status).toBe('planning');
    expect(recovered!.projection.status).toBe('planning');
  });

  it('supports recovery of failed executions', () => {
    const filePath = makeTempFile('vestara-activity-history-');
    const executionId = 'exec_failed';
    const execution = buildExecution(executionId);
    const store = new FileActivityHistoryStore(filePath);
    const recorder = new ActivityHistoryRecorderImpl(store);

    const result = buildCoordinatorResult(executionId);
    recorder.recordCoordinatorResult({
      execution,
      result: {
        ...result,
        outcome: 'failed',
        handoffEligible: false,
        changedFiles: [],
        events: [
          { type: 'execution-failed', at: '2026-08-18T10:02:00Z', detail: 'timeout' },
        ],
      },
    });

    const recovered = recoverExecution(new FileActivityHistoryStore(filePath), executionId);
    expect(recovered!.fact.status).toBe('failed');
    expect(recovered!.projection.status).toBe('failed');
  });
});

// ── Recorder ───────────────────────────────────────────────────────

describe('ARX-011 recorder', () => {
  it('records execution-requested facts', () => {
    const store = new InMemoryActivityHistoryStore();
    const recorder = new ActivityHistoryRecorderImpl(store);
    const execution = buildExecution('exec_request');

    const fact = recorder.recordExecution({ execution });

    expect(fact.executionId).toBe('exec_request');
    expect(fact.complexity).toBe('standard');
    expect(store.events('exec_request')).toHaveLength(1);
    expect(store.events('exec_request')[0]?.type).toBe('execution-requested');
  });

  it('records coordinator results into authoritative facts + events', () => {
    const store = new InMemoryActivityHistoryStore();
    const recorder = new ActivityHistoryRecorderImpl(store);
    const executionId = 'exec_full';

    const fact: ActivityExecutionFact = recorder.recordCoordinatorResult({
      execution: buildExecution(executionId),
      result: buildCoordinatorResult(executionId),
    });

    expect(fact.status).toBe('completed');
    expect(fact.complexity).toBe('standard');
    expect(fact.participants[0]?.status).toBe('completed');
    expect(fact.runtimeSessionId).toBe('opencode:ses_x');
    expect(fact.verificationFingerprint).toBe('sha256:abc123');
    expect(fact.evidenceHash).toBe('sha256:def456');

    const types = store.events(executionId).map((e) => e.type);
    expect(types).toEqual([
      'execution-requested',
      'runtime-connected',
      'file-changed',
      'file-changed',
      'runtime-completed',
      'verification-started',
      'verification-completed',
      'evidence-recorded',
      'execution-completed',
    ]);
  });

  it('records an INDETERMINATE verdict as runtime-completed → blocked, not completed', () => {
    const store = new InMemoryActivityHistoryStore();
    const recorder = new ActivityHistoryRecorderImpl(store);
    const executionId = 'exec_indeterminate';

    const fact = recorder.recordCoordinatorResult({
      execution: buildExecution(executionId),
      result: {
        ...buildCoordinatorResult(executionId),
        handoffEligible: false,
        verification: {
          conclusion: 'indeterminate',
          freshness: 'current',
          level: 'V1',
          affectedModules: ['cli'],
          fingerprint: 'sha256:abc123',
          reasons: [{ kind: 'insufficient-evidence', message: 'Verification report is missing.' }],
        },
      },
    });

    // Authoritative state stays failed; the narrative says "blocked".
    expect(fact.status).toBe('failed');

    const events = store.events(executionId);
    expect(events.some((e) => e.type === 'runtime-completed')).toBe(true);
    expect(events.some((e) => e.type === 'execution-completed')).toBe(false);
    const blocked = events.find((e) => e.type === 'execution-blocked');
    expect(blocked?.type === 'execution-blocked' ? blocked.payload : null).toMatchObject({
      reason: 'Verification report is missing.',
      changedFiles: ['src/cli.ts', 'tests/cli.test.ts'],
    });
    const verification = events.find((e) => e.type === 'verification-completed');
    expect(verification?.type === 'verification-completed' ? verification.payload : null).toMatchObject({
      conclusion: 'indeterminate',
      reasons: [{ kind: 'insufficient-evidence', message: 'Verification report is missing.' }],
    });
  });

  it('records a FAIL verdict as runtime-completed → failed', () => {
    const store = new InMemoryActivityHistoryStore();
    const recorder = new ActivityHistoryRecorderImpl(store);
    const executionId = 'exec_fail_verdict';

    const fact = recorder.recordCoordinatorResult({
      execution: buildExecution(executionId),
      result: {
        ...buildCoordinatorResult(executionId),
        handoffEligible: false,
        verification: {
          conclusion: 'fail',
          freshness: 'current',
          level: 'V1',
          affectedModules: ['cli'],
          fingerprint: 'sha256:abc123',
          reasons: [{ kind: 'change-failure', message: 'Verification failed due to changes in this execution' }],
        },
      },
    });

    expect(fact.status).toBe('failed');
    const events = store.events(executionId);
    expect(events.some((e) => e.type === 'runtime-completed')).toBe(true);
    expect(events.some((e) => e.type === 'execution-completed')).toBe(false);
    expect(events.some((e) => e.type === 'execution-blocked')).toBe(false);
    const failed = events.find((e) => e.type === 'execution-failed');
    expect(failed?.type === 'execution-failed' ? failed.payload : null).toMatchObject({
      error: 'Verification failed due to changes in this execution',
    });
  });

  it('is idempotent — recording the same result twice does not duplicate', () => {
    const store = new InMemoryActivityHistoryStore();
    const recorder = new ActivityHistoryRecorderImpl(store);
    const executionId = 'exec_idem';
    const input = {
      execution: buildExecution(executionId),
      result: buildCoordinatorResult(executionId),
    };

    recorder.recordCoordinatorResult(input);
    recorder.recordCoordinatorResult(input);

    expect(store.events(executionId)).toHaveLength(9);
  });

  it('lists executions newest-first within a room', () => {
    const store = new InMemoryActivityHistoryStore();
    const recorder = new ActivityHistoryRecorderImpl(store);

    recorder.recordExecution({ execution: { ...buildExecution('exec_a'), updatedAt: '2026-08-18T09:00:00Z' } });
    recorder.recordExecution({ execution: { ...buildExecution('exec_b'), updatedAt: '2026-08-18T11:00:00Z' } });
    recorder.recordExecution({ execution: { ...buildExecution('exec_c'), request: { goal: 'g', agentId: 'a', roomId: 'other-room' }, updatedAt: '2026-08-18T10:00:00Z' } });

    const roomList = store.listExecutions('activity-room').map((f) => f.executionId);
    expect(roomList).toEqual(['exec_b', 'exec_a']);
  });
});