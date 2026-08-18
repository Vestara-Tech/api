import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import type { Execution } from '../../../src/execution/domain/contracts.js';
import { FileExecutionStore } from '../../../src/execution/store.js';

const createdDirs: string[] = [];

afterEach(() => {
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop();
    if (!dir) continue;
    rmSync(dir, { recursive: true, force: true });
  }
});

function buildExecution(id: string, roomId: string): Execution {
  const request = {
    id: `${id}_request`,
    goal: 'Build the Theme Builder',
    agentId: 'vestara-developer',
    agentName: 'Developer',
    roomId,
    principalId: 'console-user',
    requestedAt: '2026-08-18T00:00:00.000Z',
  } as const;
  return {
    id,
    request,
    status: 'planning',
    plan: {
      id: `${id}_plan`,
      executionId: id,
      status: 'planning',
      request,
      intent: {
        kind: 'build',
        target: 'Theme Builder',
        confidence: 0.98,
        complexity: 'complex',
        ambiguities: [],
        requiredCapabilities: ['workflows', 'tasks', 'generator', 'verification'],
      },
      capabilities: [],
      milestones: [],
      evidence: ['workflow definition'],
      warnings: [],
      summary: 'Build the Theme Builder through available capabilities.',
      generatedAt: '2026-08-18T00:00:00.000Z',
    },
    events: [
      {
        id: `${id}_evt`,
        executionId: id,
        type: 'requested',
        at: '2026-08-18T00:00:00.000Z',
        actorId: 'console-user',
        detail: request.goal,
      },
    ],
    lease: {
      id: `${id}_lease`,
      executionId: id,
      holder: request.agentId,
      issuedAt: '2026-08-18T00:00:00.000Z',
      expiresAt: '2026-08-18T00:15:00.000Z',
    },
    createdAt: '2026-08-18T00:00:00.000Z',
    updatedAt: '2026-08-18T00:00:00.000Z',
  };
}

describe('FileExecutionStore', () => {
  it('persists and reloads execution drafts from disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vestara-execution-store-'));
    createdDirs.push(dir);
    const filePath = join(dir, 'executions.json');

    const first = new FileExecutionStore(filePath);
    const execution = buildExecution('exec_theme_builder', 'activity-room');
    first.upsert(execution);

    const second = new FileExecutionStore(filePath);
    expect(second.get(execution.id)?.request.goal).toBe('Build the Theme Builder');
    expect(second.list('activity-room')).toHaveLength(1);
    expect(second.list('activity-room')[0]?.plan.summary).toContain('Theme Builder');
  });
});
