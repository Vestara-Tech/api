import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { InMemoryActivityHistoryStore, FileActivityHistoryStore } from '../../src/activity-room/history/store.js';
import type { ActivityExecutionFact, ActivityHistoryStore } from '../../src/activity-room/history/contracts.js';
import { ActivityBrowserImpl } from '../../src/activity-room/browse/browser.js';
import type { ActivityHistoryQuery } from '../../src/activity-room/browse/contracts.js';

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

let counter = 0;

function makeFact(partial: Partial<ActivityExecutionFact> & Pick<ActivityExecutionFact, 'executionId' | 'updatedAt'>): ActivityExecutionFact {
  counter += 1;
  return {
    roomId: 'activity-room',
    goal: `Goal for ${partial.executionId}`,
    agentId: 'vestara-developer',
    complexity: 'standard',
    participants: [
      { role: 'developer', agentId: 'vestara-developer', status: 'completed' },
      { role: 'verifier', agentId: 'vestara-verifier', status: 'completed' },
    ],
    status: 'completed',
    createdAt: '2026-08-18T10:00:00Z',
    updatedAt: '2026-08-18T10:00:00Z',
    ...partial,
  };
}

function addFileChanges(store: ActivityHistoryStore, executionId: string, paths: string[]): void {
  for (const path of paths) {
    store.appendEvent({ executionId, occurredAt: '2026-08-18T10:01:00Z', type: 'file-changed', payload: { path } });
  }
}

function browse(store: ActivityHistoryStore, query: ActivityHistoryQuery = {}) {
  return new ActivityBrowserImpl(store).browse({ roomId: 'activity-room', ...query });
}

// ── Ordering ────────────────────────────────────────────────────────

describe('ARX-012 browsing — ordering', () => {
  it('defaults to newest-first', () => {
    const store = new InMemoryActivityHistoryStore();
    store.upsertExecution(makeFact({ executionId: 'exec_a', updatedAt: '2026-08-18T09:00:00Z' }));
    store.upsertExecution(makeFact({ executionId: 'exec_b', updatedAt: '2026-08-18T11:00:00Z' }));
    store.upsertExecution(makeFact({ executionId: 'exec_c', updatedAt: '2026-08-18T10:00:00Z' }));

    const page = browse(store);
    expect(page.items.map((item) => item.executionId)).toEqual(['exec_b', 'exec_c', 'exec_a']);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeUndefined();
  });

  it('supports oldest-first', () => {
    const store = new InMemoryActivityHistoryStore();
    store.upsertExecution(makeFact({ executionId: 'exec_a', updatedAt: '2026-08-18T09:00:00Z' }));
    store.upsertExecution(makeFact({ executionId: 'exec_b', updatedAt: '2026-08-18T11:00:00Z' }));

    const page = browse(store, { sort: 'oldest' });
    expect(page.items.map((item) => item.executionId)).toEqual(['exec_a', 'exec_b']);
  });

  it('breaks ties deterministically by executionId', () => {
    const store = new InMemoryActivityHistoryStore();
    store.upsertExecution(makeFact({ executionId: 'exec_zz', updatedAt: '2026-08-18T10:00:00Z' }));
    store.upsertExecution(makeFact({ executionId: 'exec_aa', updatedAt: '2026-08-18T10:00:00Z' }));

    const page = browse(store, { sort: 'oldest' });
    expect(page.items.map((item) => item.executionId)).toEqual(['exec_aa', 'exec_zz']);
  });
});

// ── Filtering ───────────────────────────────────────────────────────

describe('ARX-012 browsing — filters', () => {
  it('filters by status', () => {
    const store = new InMemoryActivityHistoryStore();
    store.upsertExecution(makeFact({ executionId: 'exec_done', status: 'completed' }));
    store.upsertExecution(makeFact({ executionId: 'exec_run', status: 'running' }));

    const page = browse(store, { status: ['running'] });
    expect(page.items.map((item) => item.executionId)).toEqual(['exec_run']);
  });

  it('searches goals case-insensitively by substring', () => {
    const store = new InMemoryActivityHistoryStore();
    store.upsertExecution(makeFact({ executionId: 'exec_cli', goal: 'Add a CLI command that shows DEX runtime status' }));
    store.upsertExecution(makeFact({ executionId: 'exec_theme', goal: 'Build the Theme Builder' }));

    const page = browse(store, { goal: 'cli command' });
    expect(page.items.map((item) => item.executionId)).toEqual(['exec_cli']);
  });

  it('filters by complexity', () => {
    const store = new InMemoryActivityHistoryStore();
    store.upsertExecution(makeFact({ executionId: 'exec_complex', complexity: 'complex' }));
    store.upsertExecution(makeFact({ executionId: 'exec_simple', complexity: 'simple' }));

    const page = browse(store, { complexity: ['complex'] });
    expect(page.items.map((item) => item.executionId)).toEqual(['exec_complex']);
  });

  it('filters by agentId', () => {
    const store = new InMemoryActivityHistoryStore();
    store.upsertExecution(makeFact({ executionId: 'exec_dev', agentId: 'vestara-developer' }));
    store.upsertExecution(makeFact({ executionId: 'exec_ver', agentId: 'vestara-verifier' }));

    const page = browse(store, { agentId: 'vestara-verifier' });
    expect(page.items.map((item) => item.executionId)).toEqual(['exec_ver']);
  });

  it('filters by workflowId', () => {
    const store = new InMemoryActivityHistoryStore();
    store.upsertExecution(makeFact({ executionId: 'exec_wf', workflowId: 'wf-build' }));
    store.upsertExecution(makeFact({ executionId: 'exec_plain' }));

    const page = browse(store, { workflowId: 'wf-build' });
    expect(page.items.map((item) => item.executionId)).toEqual(['exec_wf']);
  });

  it('filters by verification conclusion', () => {
    const store = new InMemoryActivityHistoryStore();
    store.upsertExecution(makeFact({ executionId: 'exec_pass', status: 'completed', verificationFingerprint: 'sha256:abc' }));
    store.upsertExecution(makeFact({ executionId: 'exec_fail', status: 'failed' }));
    store.upsertExecution(makeFact({ executionId: 'exec_unknown', status: 'completed' }));
    store.upsertExecution(makeFact({ executionId: 'exec_verifying', status: 'verifying' }));
    store.upsertExecution(makeFact({ executionId: 'exec_pending', status: 'running' }));

    const pass = browse(store, { verification: ['pass'] });
    expect(pass.items.map((item) => item.executionId)).toEqual(['exec_pass']);

    const fail = browse(store, { verification: ['fail'] });
    expect(fail.items.map((item) => item.executionId)).toEqual(['exec_fail']);

    const indeterminate = browse(store, { verification: ['indeterminate'] });
    expect(indeterminate.items.map((item) => item.executionId).sort()).toEqual(['exec_unknown', 'exec_verifying']);

    const pending = browse(store, { verification: ['pending'] });
    expect(pending.items.map((item) => item.executionId)).toEqual(['exec_pending']);
  });

  it('filters by date range (from/to)', () => {
    const store = new InMemoryActivityHistoryStore();
    store.upsertExecution(makeFact({ executionId: 'exec_early', updatedAt: '2026-08-18T08:00:00Z' }));
    store.upsertExecution(makeFact({ executionId: 'exec_mid', updatedAt: '2026-08-18T10:00:00Z' }));
    store.upsertExecution(makeFact({ executionId: 'exec_late', updatedAt: '2026-08-18T12:00:00Z' }));

    const page = browse(store, { from: '2026-08-18T09:00:00Z', to: '2026-08-18T11:00:00Z' });
    expect(page.items.map((item) => item.executionId)).toEqual(['exec_mid']);
  });

  it('combines independent filters', () => {
    const store = new InMemoryActivityHistoryStore();
    store.upsertExecution(makeFact({ executionId: 'exec_match', status: 'completed', complexity: 'complex', agentId: 'vestara-developer' }));
    store.upsertExecution(makeFact({ executionId: 'exec_no_status', status: 'running', complexity: 'complex', agentId: 'vestara-developer' }));
    store.upsertExecution(makeFact({ executionId: 'exec_no_complex', status: 'completed', complexity: 'simple', agentId: 'vestara-developer' }));
    store.upsertExecution(makeFact({ executionId: 'exec_no_agent', status: 'completed', complexity: 'complex', agentId: 'vestara-verifier' }));

    const page = browse(store, { status: ['completed'], complexity: ['complex'], agentId: 'vestara-developer' });
    expect(page.items.map((item) => item.executionId)).toEqual(['exec_match']);
  });

  it('returns an empty page when nothing matches', () => {
    const store = new InMemoryActivityHistoryStore();
    store.upsertExecution(makeFact({ executionId: 'exec_only', status: 'completed' }));

    const page = browse(store, { status: ['failed'] });
    expect(page.items).toEqual([]);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeUndefined();
  });
});

// ── Pagination ──────────────────────────────────────────────────────

describe('ARX-012 browsing — cursor pagination', () => {
  it('paginates in bounded pages using an opaque cursor', () => {
    const store = new InMemoryActivityHistoryStore();
    for (let i = 0; i < 5; i += 1) {
      store.upsertExecution(makeFact({ executionId: `exec_${i}`, updatedAt: `2026-08-18T1${i}:00:00Z` }));
    }

    const first = browse(store, { limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.hasMore).toBe(true);
    expect(first.nextCursor).toBeDefined();
    expect(first.items.map((item) => item.executionId)).toEqual(['exec_4', 'exec_3']);

    const second = browse(store, { limit: 2, cursor: first.nextCursor });
    expect(second.items.map((item) => item.executionId)).toEqual(['exec_2', 'exec_1']);
    expect(second.hasMore).toBe(true);

    const third = browse(store, { limit: 2, cursor: second.nextCursor });
    expect(third.items.map((item) => item.executionId)).toEqual(['exec_0']);
    expect(third.hasMore).toBe(false);
    expect(third.nextCursor).toBeUndefined();
  });

  it('does not duplicate or skip items across pages', () => {
    const store = new InMemoryActivityHistoryStore();
    for (let i = 0; i < 7; i += 1) {
      store.upsertExecution(makeFact({ executionId: `exec_${i}`, updatedAt: `2026-08-18T1${i}:00:00Z` }));
    }

    const all: string[] = [];
    let cursor: string | undefined;
    for (;;) {
      const page = browse(store, { limit: 3, cursor });
      all.push(...page.items.map((item) => item.executionId));
      if (!page.hasMore) break;
      cursor = page.nextCursor;
    }

    expect(all).toHaveLength(7);
    expect(new Set(all).size).toBe(7);
    expect(all).toEqual(['exec_6', 'exec_5', 'exec_4', 'exec_3', 'exec_2', 'exec_1', 'exec_0']);
  });

  it('keeps an existing traversal stable when a new record arrives mid-browse', () => {
    const store = new InMemoryActivityHistoryStore();
    store.upsertExecution(makeFact({ executionId: 'exec_c', updatedAt: '2026-08-18T12:00:00Z' }));
    store.upsertExecution(makeFact({ executionId: 'exec_b', updatedAt: '2026-08-18T11:00:00Z' }));
    store.upsertExecution(makeFact({ executionId: 'exec_a', updatedAt: '2026-08-18T10:00:00Z' }));

    const page1 = browse(store, { limit: 2 });
    expect(page1.items.map((item) => item.executionId)).toEqual(['exec_c', 'exec_b']);

    // Newest record X lands between page 1 and page 2.
    store.upsertExecution(makeFact({ executionId: 'exec_x', updatedAt: '2026-08-18T13:00:00Z' }));

    const page2 = browse(store, { limit: 2, cursor: page1.nextCursor });
    expect(page2.items.map((item) => item.executionId)).toEqual(['exec_a']);
    expect(page2.hasMore).toBe(false);
  });

  it('falls back to the start when the cursor no longer resolves', () => {
    const store = new InMemoryActivityHistoryStore();
    store.upsertExecution(makeFact({ executionId: 'exec_a', updatedAt: '2026-08-18T10:00:00Z' }));

    const page = browse(store, { cursor: 'cur_invalid_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' });
    expect(page.items.map((item) => item.executionId)).toEqual(['exec_a']);
  });

  it('treats a malformed cursor as absent', () => {
    const store = new InMemoryActivityHistoryStore();
    store.upsertExecution(makeFact({ executionId: 'exec_a', updatedAt: '2026-08-18T10:00:00Z' }));

    const page = browse(store, { cursor: 'not-a-real-cursor' });
    expect(page.items.map((item) => item.executionId)).toEqual(['exec_a']);
  });

  it('enforces a sane limit (1..100)', () => {
    const store = new InMemoryActivityHistoryStore();
    for (let i = 0; i < 150; i += 1) {
      store.upsertExecution(makeFact({ executionId: `exec_${i}`, updatedAt: `2026-08-18T${Math.floor(i / 10)}:${(i % 10).toString().padStart(2, '0')}:00Z` }));
    }

    expect(browse(store, { limit: 0 }).items).toHaveLength(1);
    expect(browse(store, { limit: 500 }).items).toHaveLength(100);
    expect(browse(store, { limit: 10 }).items).toHaveLength(10);
  });
});

// ── Summary projection ──────────────────────────────────────────────

describe('ARX-012 browsing — summary projection', () => {
  it('projects a complete, bounded summary without raw facts', () => {
    const store = new InMemoryActivityHistoryStore();
    store.upsertExecution(
      makeFact({
        executionId: 'exec_slim',
        goal: 'Add a CLI command that shows DEX runtime status',
        complexity: 'complex',
        status: 'completed',
        agentId: 'vestara-developer',
        verificationFingerprint: 'sha256:abc',
        startedAt: '2026-08-18T09:00:00Z',
        updatedAt: '2026-08-18T10:00:00Z',
      }),
    );
    addFileChanges(store, 'exec_slim', ['src/cli.ts', 'tests/cli.test.ts', 'docs/cli.md']);

    const page = browse(store);
    expect(page.items).toHaveLength(1);
    const item = page.items[0];
    expect(item).toEqual({
      executionId: 'exec_slim',
      goal: 'Add a CLI command that shows DEX runtime status',
      complexity: 'complex',
      status: 'completed',
      participants: ['vestara-developer', 'vestara-verifier'],
      verification: { conclusion: 'pass', handoffEligible: true },
      changedFileCount: 3,
      startedAt: '2026-08-18T09:00:00Z',
      updatedAt: '2026-08-18T10:00:00Z',
    });
  });

  it('does not leak runtime hashes or workflow internals into summaries', () => {
    const store = new InMemoryActivityHistoryStore();
    store.upsertExecution(
      makeFact({
        executionId: 'exec_guarded',
        workflowId: 'wf-build',
        runtimeSessionId: 'opencode:ses_secret',
        verificationFingerprint: 'sha256:secret',
        evidenceHash: 'sha256:secret2',
      }),
    );

    const item = browse(store).items[0];
    expect(item).not.toHaveProperty('workflowId');
    expect(item).not.toHaveProperty('runtimeSessionId');
    expect(item).not.toHaveProperty('verificationFingerprint');
    expect(item).not.toHaveProperty('evidenceHash');
  });

  it('computes changedFileCount only from persisted file-changed events', () => {
    const store = new InMemoryActivityHistoryStore();
    store.upsertExecution(makeFact({ executionId: 'exec_0files' }));
    addFileChanges(store, 'exec_0files', ['a.ts', 'b.ts']);

    expect(browse(store).items[0]?.changedFileCount).toBe(2);
  });

  it('derives handoffEligible only when verification is present and passed', () => {
    const store = new InMemoryActivityHistoryStore();
    store.upsertExecution(makeFact({ executionId: 'exec_verified', status: 'completed', verificationFingerprint: 'sha256:abc' }));
    store.upsertExecution(makeFact({ executionId: 'exec_no_verification', status: 'completed' }));
    store.upsertExecution(makeFact({ executionId: 'exec_running' }));

    const byId = Object.fromEntries(browse(store).items.map((item) => [item.executionId, item]));
    expect(byId['exec_verified']?.verification.handoffEligible).toBe(true);
    expect(byId['exec_no_verification']?.verification.handoffEligible).toBe(false);
    expect(byId['exec_running']?.verification.handoffEligible).toBe(false);
  });
});

// ── Durability ──────────────────────────────────────────────────────

describe('ARX-012 browsing — durable history', () => {
  it('browses execution history after a restart (from disk)', () => {
    const filePath = makeTempFile('vestara-activity-browse-');
    const first = new FileActivityHistoryStore(filePath);
    first.upsertExecution(makeFact({ executionId: 'exec_old', status: 'completed', updatedAt: '2026-08-18T08:00:00Z' }));
    first.upsertExecution(makeFact({ executionId: 'exec_new', status: 'running', updatedAt: '2026-08-18T12:00:00Z' }));
    addFileChanges(first, 'exec_old', ['src/a.ts']);

    const second = new FileActivityHistoryStore(filePath);
    const page = new ActivityBrowserImpl(second).browse({ roomId: 'activity-room', status: ['completed'], limit: 5 });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.executionId).toBe('exec_old');
    expect(page.items[0]?.changedFileCount).toBe(1);
    expect(page.items[0]?.verification.conclusion).toBe('indeterminate');
  });
});