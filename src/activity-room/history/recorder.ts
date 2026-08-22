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

export interface RecordWorkflowStartInput {
  readonly execution: ExecutionRecord;
  readonly workflowId: string;
  readonly workflowRunId: string;
}

export interface RecordWorkflowProgressInput {
  readonly execution: ExecutionRecord;
  readonly workflowId: string;
  readonly workflowRunId: string;
  readonly stepId: string;
  readonly role: string;
}

export interface RecordWorkflowFailureInput {
  readonly execution: ExecutionRecord;
  readonly workflowId: string;
  readonly workflowRunId: string;
  readonly error?: string | undefined;
}

export interface ActivityHistoryRecorder {
  recordExecution(input: RecordExecutionInput): ActivityExecutionFact;
  recordCoordinatorResult(input: RecordCoordinatorInput): ActivityExecutionFact;
  recordWorkflowStart(input: RecordWorkflowStartInput): ActivityExecutionFact;
  recordWorkflowProgress(input: RecordWorkflowProgressInput): ActivityExecutionFact;
  recordWorkflowFailure(input: RecordWorkflowFailureInput): ActivityExecutionFact;
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
    const runtimeCompleted = result.outcome === 'completed';
    const handoffEligible = result.handoffEligible && result.verification.freshness === 'current';
    const status: ActivityExecutionStatus = runtimeCompleted
      ? handoffEligible
        ? 'completed'
        : 'failed'
      : result.outcome === 'failed'
        ? 'failed'
        : result.outcome === 'cancelled'
          ? 'cancelled'
          : 'running';

    const participantStatus: ActivityParticipantProjection['status'] =
      runtimeCompleted
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
    this.recordExecutionEvents(execution, result, runtimeCompleted);

    return fact;
  }

  /**
   * ARX-STAB-003 — Record the start of a governed workflow run and the
   * execution↔workflow correlation as a durable fact + event.
   */
  recordWorkflowStart(input: RecordWorkflowStartInput): ActivityExecutionFact {
    const base = this.buildFact(input.execution);
    const fact: ActivityExecutionFact = {
      ...base,
      workflowId: input.workflowId,
      workflowRunId: input.workflowRunId,
      status: 'running',
      participants: [
        {
          role: 'planner',
          agentId: 'vestara-planner',
          status: 'active',
        },
      ],
      ...(base.startedAt !== undefined ? { startedAt: base.startedAt } : { startedAt: new Date().toISOString() }),
    };
    this.store.upsertExecution(fact);

    const occurredAt = fact.startedAt ?? new Date().toISOString();
    this.appendEvent({
      executionId: input.execution.id,
      occurredAt,
      type: 'workflow-started',
      payload: { workflowId: input.workflowId, workflowRunId: input.workflowRunId },
    });
    this.appendEvent({
      executionId: input.execution.id,
      occurredAt,
      type: 'workflow-progressed',
      payload: { workflowId: input.workflowId, workflowRunId: input.workflowRunId, stepId: 'plan', role: 'planner' },
    });

    return fact;
  }

  /**
   * ARX-STAB-003 — Record workflow step progression (e.g. planner→developer)
   * as a durable event.
   */
  recordWorkflowProgress(input: RecordWorkflowProgressInput): ActivityExecutionFact {
    const fact = this.store.getExecution(input.execution.id);
    const base = fact ?? this.buildFact(input.execution);
    const participants = upsertParticipant(base.participants, { role: input.role, agentId: roleToAgentId(input.role), status: 'active' });
    const updated: ActivityExecutionFact = {
      ...base,
      participants,
      status: 'running',
      updatedAt: new Date().toISOString(),
    };
    this.store.upsertExecution(updated);

    this.appendEvent({
      executionId: input.execution.id,
      occurredAt: new Date().toISOString(),
      type: 'workflow-progressed',
      payload: {
        workflowId: input.workflowId,
        workflowRunId: input.workflowRunId,
        stepId: input.stepId,
        role: input.role,
      },
    });

    return updated;
  }

  /**
   * ARX-STAB-003 — Record a workflow start failure as a durable event and
   * move the execution fact to a non-success state.
   */
  recordWorkflowFailure(input: RecordWorkflowFailureInput): ActivityExecutionFact {
    const fact = this.store.getExecution(input.execution.id);
    const base = fact ?? this.buildFact(input.execution);
    const updated: ActivityExecutionFact = {
      ...base,
      workflowId: input.workflowId,
      workflowRunId: input.workflowRunId,
      status: 'failed',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.store.upsertExecution(updated);

    this.appendEvent({
      executionId: input.execution.id,
      occurredAt: new Date().toISOString(),
      type: 'workflow-failed',
      payload: {
        workflowId: input.workflowId,
        workflowRunId: input.workflowRunId,
        ...(input.error !== undefined ? { error: input.error } : {}),
      },
    });

    return updated;
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

  private recordExecutionEvents(execution: ExecutionRecord, result: CoordinatorResult, runtimeCompleted: boolean): void {
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

    // The governed developer began implementation: context assembled and the
    // CAR session connected to the live coding runtime.
    const skills = result.context?.governance?.skills ?? [];
    if (skills.length > 0) {
      push(
        {
          type: 'context-assembled',
          payload: { skills: skills.map((skill) => skill.id) },
        },
        this.firstEventAt(result),
      );
    }
    if (result.runtimeId !== undefined) {
      push(
        {
          type: 'runtime-connected',
          payload: {
            runtimeId: result.runtimeId,
            sessionId: result.sessionId ?? result.runtimeId,
            ...(result.runtimeModel !== undefined ? { model: result.runtimeModel } : {}),
          },
        },
        this.firstEventAt(result),
      );
    }

    // Coding-runtime activity in natural causal order: session → tool request
    // → completion → file mutation, interleaved exactly as observed from the
    // CAR/OpenCode session.
    for (const event of result.events) {
      if (event.type === 'file-changed' && event.path !== undefined) {
        push({ type: 'file-changed', payload: { path: event.path } }, event.at);
      } else if (event.type === 'session-created' && event.sessionId !== undefined) {
        push(
          {
            type: 'session-created',
            payload: {
              sessionId: event.sessionId,
              runtimeId: event.runtime,
              ...(event.model !== undefined ? { model: event.model } : {}),
            },
          },
          event.at,
        );
      } else if (event.type === 'session-resumed' && event.sessionId !== undefined) {
        push({ type: 'session-resumed', payload: { sessionId: event.sessionId } }, event.at);
      } else if (event.type === 'tool-requested' && event.name !== undefined) {
        push({ type: 'tool-requested', payload: { name: event.name } }, event.at);
      } else if (event.type === 'tool-completed' && event.name !== undefined) {
        push({ type: 'tool-completed', payload: { name: event.name, ok: true } }, event.at);
      }
    }

    // The coding runtime completed (CAR/OpenCode session finished). This is a
    // distinct boundary from governed execution completion: the overall
    // execution is not "completed" until VCTRL grants handoff eligibility.
    if (runtimeCompleted) {
      push(
        {
          type: 'runtime-completed',
          payload: {
            runtimeId: result.runtimeId,
            ...(result.sessionId !== undefined ? { sessionId: result.sessionId } : {}),
            changedFiles: result.changedFiles,
          },
        },
        this.lastEventAt(result),
      );
    }

    let verificationStarted = false;
    for (const event of result.events) {
      if (event.type === 'verification-started') {
        push({ type: 'verification-started', payload: {} }, event.at);
        verificationStarted = true;
      }
    }
    if (runtimeCompleted && !verificationStarted) {
      push({
        type: 'verification-started',
        payload: {
          ...(result.verification.level !== undefined ? { level: result.verification.level } : {}),
        },
      });
    }

    const reasons =
      result.verification.reasons !== undefined && result.verification.reasons.length > 0
        ? result.verification.reasons
        : undefined;

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
          ...(reasons !== undefined ? { reasons } : {}),
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
      const conclusion = result.verification.conclusion;
      if (result.handoffEligible && result.verification.freshness === 'current') {
        push(
          {
            type: 'execution-completed',
            payload: {
              outcome: 'completed',
              changedFiles: result.changedFiles,
              handoffEligible: true,
            },
          },
          this.lastEventAt(result),
        );
      } else if (conclusion === 'fail') {
        push(
          {
            type: 'execution-failed',
            payload: {
              ...(reasonMessage(reasons) !== undefined ? { error: reasonMessage(reasons) } : {}),
            },
          },
          this.lastEventAt(result),
        );
      } else {
        // Runtime completed but governance cannot hand off (INDETERMINATE or
        // stale). The implementation itself did not fail — the handoff is
        // blocked pending verification.
        push(
          {
            type: 'execution-blocked',
            payload: {
              reason: reasonMessage(reasons) ?? 'Handoff blocked pending verification',
              ...(reasons !== undefined ? { reasons } : {}),
              ...(result.changedFiles.length > 0 ? { changedFiles: result.changedFiles } : {}),
            },
          },
          this.lastEventAt(result),
        );
      }
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

function reasonMessage(reasons: readonly { kind: string; message: string }[] | undefined): string | undefined {
  return reasons?.[0]?.message;
}

function roleToAgentId(role: string): string {
  const map: Record<string, string> = {
    planner: 'vestara-planner',
    developer: 'vestara-developer',
    reviewer: 'vestara-reviewer',
    verifier: 'vestara-verifier',
  };
  return map[role] ?? `vestara-${role}`;
}

function upsertParticipant(
  participants: readonly ActivityParticipantProjection[],
  participant: ActivityParticipantProjection,
): readonly ActivityParticipantProjection[] {
  const existing = participants.some((p) => p.agentId === participant.agentId);
  if (existing) {
    return participants.map((p) => (p.agentId === participant.agentId ? { ...p, ...participant } : p));
  }
  return [...participants, participant];
}