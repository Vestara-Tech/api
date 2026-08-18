/**
 * ARX-CP2 ARX-011 — Durable Activity history stores.
 *
 * FileActivityHistoryStore persists authoritative execution facts and
 * monotonic event envelopes to a JSON file, surviving process restart.
 * InMemoryActivityHistoryStore provides the same contract for tests.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { hashOf } from '../../generator/domain/hash.js';
import type {
  ActivityEvent,
  ActivityEventInput,
  ActivityExecutionFact,
  ActivityHistoryStore,
} from './contracts.js';

interface ActivityHistoryFileState {
  readonly version: 1;
  readonly executions: readonly ActivityExecutionFact[];
  readonly events: readonly ActivityEvent[];
}

function isActivityEvent(value: unknown): value is ActivityEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.id === 'string' &&
    typeof event.executionId === 'string' &&
    typeof event.sequence === 'number' &&
    typeof event.occurredAt === 'string' &&
    typeof event.type === 'string' &&
    typeof event.payload === 'object' &&
    event.payload !== null
  );
}

function isExecutionFact(value: unknown): value is ActivityExecutionFact {
  if (!value || typeof value !== 'object') return false;
  const fact = value as Record<string, unknown>;
  return (
    typeof fact.executionId === 'string' &&
    typeof fact.roomId === 'string' &&
    typeof fact.goal === 'string' &&
    typeof fact.agentId === 'string' &&
    typeof fact.status === 'string' &&
    typeof fact.createdAt === 'string' &&
    typeof fact.updatedAt === 'string'
  );
}

export class InMemoryActivityHistoryStore implements ActivityHistoryStore {
  private readonly executions = new Map<string, ActivityExecutionFact>();
  private readonly eventLog = new Map<string, ActivityEvent[]>();

  getExecution(executionId: string): ActivityExecutionFact | null {
    return this.executions.get(executionId) ?? null;
  }

  listExecutions(roomId?: string): readonly ActivityExecutionFact[] {
    const facts = [...this.executions.values()].sort(
      (left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) || right.executionId.localeCompare(left.executionId),
    );
    return roomId !== undefined ? facts.filter((fact) => fact.roomId === roomId) : facts;
  }

  upsertExecution(fact: ActivityExecutionFact): ActivityExecutionFact {
    this.executions.set(fact.executionId, fact);
    return fact;
  }

  appendEvent(input: ActivityEventInput): ActivityEvent {
    const existing = this.eventLog.get(input.executionId) ?? [];
    const id = createEventId(input);
    const found = existing.find((event) => event.id === id);
    if (found) return found;

    const sequence = existing.reduce((max, event) => Math.max(max, event.sequence), 0) + 1;
    const envelope = {
      id,
      executionId: input.executionId,
      sequence,
      occurredAt: input.occurredAt,
      type: input.type,
      payload: input.payload,
    } as ActivityEvent;

    this.eventLog.set(input.executionId, [...existing, envelope]);
    return envelope;
  }

  events(executionId: string, afterSequence?: number): readonly ActivityEvent[] {
    const existing = this.eventLog.get(executionId) ?? [];
    if (afterSequence === undefined) return [...existing];
    return existing.filter((event) => event.sequence > afterSequence);
  }

  nextSequence(executionId: string): number {
    const existing = this.eventLog.get(executionId) ?? [];
    return existing.reduce((max, event) => Math.max(max, event.sequence), 0) + 1;
  }
}

export class FileActivityHistoryStore implements ActivityHistoryStore {
  private readonly executions = new Map<string, ActivityExecutionFact>();
  private readonly eventLog = new Map<string, ActivityEvent[]>();

  constructor(private readonly filePath: string) {
    this.load();
  }

  getExecution(executionId: string): ActivityExecutionFact | null {
    return this.executions.get(executionId) ?? null;
  }

  listExecutions(roomId?: string): readonly ActivityExecutionFact[] {
    const facts = [...this.executions.values()].sort(
      (left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) || right.executionId.localeCompare(left.executionId),
    );
    return roomId !== undefined ? facts.filter((fact) => fact.roomId === roomId) : facts;
  }

  upsertExecution(fact: ActivityExecutionFact): ActivityExecutionFact {
    this.executions.set(fact.executionId, fact);
    this.save();
    return fact;
  }

  appendEvent(input: ActivityEventInput): ActivityEvent {
    const existing = this.eventLog.get(input.executionId) ?? [];
    const id = createEventId(input);
    const found = existing.find((event) => event.id === id);
    if (found) return found;

    const sequence = existing.reduce((max, event) => Math.max(max, event.sequence), 0) + 1;
    const envelope = {
      id,
      executionId: input.executionId,
      sequence,
      occurredAt: input.occurredAt,
      type: input.type,
      payload: input.payload,
    } as ActivityEvent;

    this.eventLog.set(input.executionId, [...existing, envelope]);
    this.save();
    return envelope;
  }

  events(executionId: string, afterSequence?: number): readonly ActivityEvent[] {
    const existing = this.eventLog.get(executionId) ?? [];
    if (afterSequence === undefined) return [...existing];
    return existing.filter((event) => event.sequence > afterSequence);
  }

  nextSequence(executionId: string): number {
    const existing = this.eventLog.get(executionId) ?? [];
    return existing.reduce((max, event) => Math.max(max, event.sequence), 0) + 1;
  }

  private load(): void {
    if (!existsSync(this.filePath)) return;
    try {
      const raw = JSON.parse(readFileSync(this.filePath, 'utf8')) as unknown;
      if (!raw || typeof raw !== 'object') return;
      const state = raw as Partial<ActivityHistoryFileState>;
      if (Array.isArray(state.executions)) {
        for (const fact of state.executions) {
          if (isExecutionFact(fact)) this.executions.set(fact.executionId, fact);
        }
      }
      if (Array.isArray(state.events)) {
        for (const event of state.events) {
          if (isActivityEvent(event)) {
            const existing = this.eventLog.get(event.executionId) ?? [];
            this.eventLog.set(event.executionId, [...existing, event]);
          }
        }
        for (const events of this.eventLog.values()) {
          events.sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id));
        }
      }
    } catch {
      // Ignore malformed local cache; history rebuilds from fresh records.
    }
  }

  private save(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const payload: ActivityHistoryFileState = {
      version: 1,
      executions: [...this.executions.values()],
      events: [...this.eventLog.values()].flat(),
    };
    writeFileSync(this.filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }
}

/**
 * Deterministic event id from content — enables idempotent append.
 * Re-appending the same fact (same type/payload/time) is a no-op.
 */
function createEventId(input: ActivityEventInput): string {
  return `aev_${hashOf({ executionId: input.executionId, type: input.type, payload: input.payload, occurredAt: input.occurredAt }).slice(0, 20)}`;
}