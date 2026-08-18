/**
 * ARX-CP1 ARX-005 — Event normalization.
 *
 * Transforms raw DEX/CAR/OpenCode events into a small Activity vocabulary.
 * Exposes only what the human needs to understand what is happening.
 * Internal runtime noise stays in logs.
 */
import type { ActivityTimelineEvent } from './contracts.js';

/** Raw event types that map to Activity vocabulary. */
export interface RawExecutionEvent {
  readonly type: string;
  readonly at: string;
  readonly id?: string;
  readonly detail?: string;
  readonly actorId?: string;
  readonly name?: string;
  readonly text?: string;
  readonly path?: string;
  readonly command?: string;
  readonly message?: string;
}

/** Mapping from raw event type to Activity timeline event. */
type EventMapper = (event: RawExecutionEvent) => ActivityTimelineEvent | null;

function timeline(
  kind: string,
  title: string,
  status: ActivityTimelineEvent['status'],
): EventMapper {
  return (e) => {
    const detail = e.detail ?? e.message;
    return {
      id: e.id ?? `evt-${e.at}`,
      kind,
      title,
      status,
      at: e.at,
      ...(detail ? { detail } : {}),
    };
  };
}

function titled(
  kind: string,
  status: ActivityTimelineEvent['status'],
  titleFn: (e: RawExecutionEvent) => string,
): EventMapper {
  return (e) => {
    const title = titleFn(e);
    const detail = e.detail ?? e.message;
    return {
      id: e.id ?? `evt-${e.at}`,
      kind,
      title,
      status,
      at: e.at,
      ...(detail ? { detail } : {}),
    };
  };
}

const EVENT_MAP: ReadonlyMap<string, EventMapper> = new Map<string, EventMapper>([
  ['requested', timeline('execution-requested', 'Execution requested', 'info')],
  ['intent-resolved', timeline('intent-resolved', 'Intent classified', 'info')],
  ['plan-composed', timeline('plan-composed', 'Plan composed', 'info')],
  ['execution-started', timeline('execution-started', 'Execution started', 'info')],
  ['context-assembled', timeline('context-assembled', 'Context assembled', 'info')],
  ['runtime-connected', timeline('runtime-connected', 'Runtime connected', 'success')],
  ['tool-requested', titled('tool-approval-required', 'warning', (e) => `Tool approval: ${e.name ?? 'unknown'}`)],
  ['tool-approved', titled('tool-approved', 'success', (e) => `Tool approved: ${e.name ?? 'unknown'}`)],
  ['file-changed', titled('change-detected', 'info', (e) => `File changed: ${e.path ?? 'unknown'}`)],
  ['verification-started', timeline('verification-started', 'Verification started', 'info')],
  ['verification-completed', timeline('verification-completed', 'Verification completed', 'success')],
  ['evidence-recorded', timeline('evidence-recorded', 'Evidence recorded', 'success')],
  ['execution-completed', timeline('execution-completed', 'Execution completed', 'success')],
  ['execution-failed', timeline('execution-failed', 'Execution failed', 'error')],
  ['execution-cancelled', timeline('execution-cancelled', 'Execution cancelled', 'warning')],
]);

/**
 * Normalize a raw execution event into an Activity timeline event.
 * Returns null for events that should not appear in the Activity timeline
 * (SDK noise, token streaming, internal tool events).
 */
export function normalizeEvent(event: RawExecutionEvent): ActivityTimelineEvent | null {
  const mapper = EVENT_MAP.get(event.type);
  return mapper ? mapper(event) : null;
}

/**
 * Normalize a batch of raw events, filtering out noise.
 * Preserves chronological order.
 */
export function normalizeEvents(events: readonly RawExecutionEvent[]): readonly ActivityTimelineEvent[] {
  return events
    .map(normalizeEvent)
    .filter((e): e is ActivityTimelineEvent => e !== null);
}

/**
 * Determine if a raw event type is internal/runtime noise
 * that should never appear in the Activity timeline.
 */
export function isInternalEvent(type: string): boolean {
  const INTERNAL_TYPES = new Set([
    'thinking',
    'message',
    'usage',
    'tool-started',
    'tool-completed',
    'command-started',
    'command-output',
    'command-completed',
    'completed',
    'failed',
    'step-start',
    'step-finish',
    'snapshot',
    'agent',
    'retry',
    'compaction',
    'subtask',
    'reasoning',
  ]);
  return INTERNAL_TYPES.has(type);
}
