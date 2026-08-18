/**
 * ARX-CP2 ARX-011 — Activity history recorder.
 *
 * Translates DEX coordinator results and execution state into
 * authoritative facts + monotonic event envelopes. This is the write
 * side of the durable Activity history; recovery.ts is the read side.
 */

import type {
  ActivityExecutionStatus,
  ActivityParticipantProjection,
} from '../projection/contracts.js';
import type { CoordinatorResult, ExecutionRecord } from '../projection/execution-projection.js';
import { classifyComplexity } from '../projection/complexity-classifier.js';
import type {
  ActivityEventInput,
  ActivityExecutionFact,
  ActivityHistoryStore,
} from './contracts.js';

export interface RecordExecutionInput {
  readonly execution: ExecutionRecord;
}

export interface RecordCoordinatorInput {
  readonly execution: ExecutionRecord;
  readonly result: CoordinatorResult;
}

export interface ActivityHistoryRecorder {
  recordExecution(input: RecordExecutionInput): ActivityExecutionFact;
  recordCoordinatorResult(input: RecordCoordinatorInput): ActivityExecutionFact;
}

export class ActivityHistoryRecorderImpl implements ActivityHistoryRecorder {
  constructor(private readonly store: ActivityHistoryStore) {}

  recordExecution(input: RecordExecutionInput): ActivityExecutionFact {
    const execution = input.execution;
    const now = execution.updatedAt ?? execution.createdAt ?? new Date().toISOString();

    const fact = this.buildFact(execution);
    this.store.upsertExecution(fact);

    const recordedAt = execution.startedAt ?? now;
    this.appendEvent({
      executionId: execution.id,
      occurredAt: recordedAt,
      type: 'execution-requested',
      payload: {
        goal: execution.request?.goal ?? '',
        agentId: execution.request?.agentId ?? 'unknown',
        roomId: execution.request?.roomId ?? 'activity-room',
        complexity: fact.complexity,
      },
    });

    return fact;
  }

  recordCoordinatorResult(input: RecordCoordinatorInput): ActivityExecutionFact {
    const { execution, result } = input;
    const base = this.buildFact(execution);
    const status: ActivityExecutionStatus =
      result.outcome === 'completed'
        ? 'completed'
        : result.outcome === 'failed'
          ? 'failed'
          : result.outcome === 'cancelled'
            ? 'cancelled'
            : 'running';

    const participantStatus: ActivityParticipantProjection['status'] =
      status === 'completed'
        ? 'completed'
        : status === 'failed'
          ? 'failed'
          : status === 'cancelled'
            ? 'failed'
            : 'active';

    const participants: readonly ActivityParticipantProjection[] = [
      {
        role: 'developer',
        agentId: result.agentId,
        status: participantStatus,
      },
    ];

    const startedAt = this.firstEventAt(result) ?? base.startedAt;
    const completedAt = status === 'completed' || status === 'failed' || status === 'cancelled'
      ? this.lastEventAt(result) ?? new Date().toISOString()
      : undefined;
    const updatedAt = this.lastEventAt(result) ?? new Date().toISOString();

    const fact: ActivityExecutionFact = {
      executionId: result.executionId,
      roomId: base.roomId,
      goal: execution.request?.goal ?? result.events[0]?.text ?? '',
      agentId: result.agentId,
      complexity: base.complexity,
      participants,
      status,
      createdAt: base.createdAt,
      updatedAt,
      ...(startedAt !== undefined ? { startedAt } : {}),
      ...(completedAt !== undefined ? { completedAt } : {}),
      ...(result.sessionId !== undefined ? { runtimeSessionId: result.sessionId } : {}),
      ...(result.verification.fingerprint !== undefined ? { verificationFingerprint: result.verification.fingerprint } : {}),
      ...(result.evidence !== undefined ? { evidenceHash: result.evidence.evidenceHash } : {}),
    };

    this.store.upsertExecution(fact);

    // Authoritative event sequence (idempotent append).
    this.recordExecutionEvents(execution, result);

    return fact;
  }

  private buildFact(execution: ExecutionRecord): ActivityExecutionFact {
    const complexity = classifyComplexity(execution.request?.goal ?? '').level;
    const now = execution.updatedAt ?? execution.createdAt ?? new Date().toISOString();

    const fact: ActivityExecutionFact = {
      executionId: execution.id,
      roomId: execution.request?.roomId ?? 'activity-room',
      goal: execution.request?.goal ?? '',
      agentId: execution.request?.agentId ?? 'unknown',
      complexity,
      participants: [
        {
          role: 'developer',
          agentId: execution.request?.agentId ?? 'unknown',
          status: execution.status === 'completed' || execution.status === 'failed'
            ? execution.status === 'completed' ? 'completed' : 'failed'
            : execution.status === 'running' ? 'active' : 'pending',
        },
      ],
      status: mapFactStatus(execution.status),
      createdAt: execution.createdAt ?? now,
      updatedAt: now,
      ...(execution.startedAt !== undefined ? { startedAt: execution.startedAt } : {}),
      ...(execution.completedAt !== undefined ? { completedAt: execution.completedAt } : {}),
    };

    return fact;
  }

  private recordExecutionEvents(execution: ExecutionRecord, result: CoordinatorResult): void {
    const executionId = result.executionId;
    let lastAt: string | undefined;

    const push = (input: Omit<ActivityEventInput, 'executionId' | 'occurredAt'>, at?: string): void => {
      const occurredAt = at ?? lastAt ?? execution.createdAt ?? new Date().toISOString();
      lastAt = occurredAt;
      this.store.appendEvent({ executionId, occurredAt, ...input });
    };

    // Ensure the execution lifecycle is captured even when preview did not
    // record an execution-requested fact (idempotent append).
    push(
      {
        type: 'execution-requested',
        payload: {
          goal: execution.request?.goal ?? '',
          agentId: execution.request?.agentId ?? 'unknown',
          roomId: execution.request?.roomId ?? 'activity-room',
          complexity: classifyComplexity(execution.request?.goal ?? '').level,
        },
      },
      this.firstEventAt(result),
    );

    for (const event of result.events) {
      if (event.type === 'file-changed' && event.path !== undefined) {
        push({ type: 'file-changed', payload: { path: event.path } }, event.at);
      }
    }

    for (const event of result.events) {
      if (event.type === 'verification-started') {
        push({ type: 'verification-started', payload: {} }, event.at);
      }
    }

    push(
      {
        type: 'verification-completed',
        payload: {
          conclusion: result.verification.conclusion as 'pass' | 'fail' | 'indeterminate',
          freshness: result.verification.freshness as 'current' | 'stale',
          ...(result.verification.level !== undefined ? { level: result.verification.level } : {}),
          ...(result.verification.affectedModules !== undefined && result.verification.affectedModules.length > 0
            ? { modules: result.verification.affectedModules }
            : {}),
          ...(result.verification.fingerprint !== undefined ? { fingerprint: result.verification.fingerprint } : {}),
        },
      },
      this.lastEventAt(result),
    );

    if (result.evidence) {
      push(
        {
          type: 'evidence-recorded',
          payload: { evidenceHash: result.evidence.evidenceHash, outcome: result.evidence.outcome },
        },
        this.lastEventAt(result),
      );
    }

    if (result.outcome === 'completed') {
      push(
        {
          type: 'execution-completed',
          payload: {
            outcome: 'completed',
            changedFiles: result.changedFiles,
            handoffEligible: result.handoffEligible,
          },
        },
        this.lastEventAt(result),
      );
    } else if (result.outcome === 'failed') {
      const failureDetail = result.events.find((event) => event.type === 'execution-failed')?.detail;
      push(
        {
          type: 'execution-failed',
          payload: { ...(failureDetail !== undefined ? { error: failureDetail } : {}) },
        },
        this.lastEventAt(result),
      );
    } else if (result.outcome === 'cancelled') {
      push({ type: 'execution-cancelled', payload: {} }, this.lastEventAt(result));
    }
  }

  private appendEvent(input: ActivityEventInput): void {
    this.store.appendEvent(input);
  }

  private firstEventAt(result: CoordinatorResult): string | undefined {
    return result.events[0]?.at;
  }

  private lastEventAt(result: CoordinatorResult): string | undefined {
    return result.events.length > 0 ? result.events[result.events.length - 1]?.at : undefined;
  }
}

function mapFactStatus(status: string): ActivityExecutionStatus {
  const map: Record<string, ActivityExecutionStatus> = {
    requested: 'idle',
    analyzing: 'planning',
    planning: 'planning',
    'awaiting-approval': 'awaiting-approval',
    queued: 'running',
    running: 'running',
    blocked: 'failed',
    reviewing: 'verifying',
    verifying: 'verifying',
    completed: 'completed',
    failed: 'failed',
    cancelled: 'cancelled',
  };
  return map[status] ?? 'idle';
}