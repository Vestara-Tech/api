/**
 * ARX-CP1 ARX-006 — Conversation message filtering.
 *
 * Agents should communicate on meaningful transitions,
 * not narrate every internal operation.
 *
 * This module determines which raw runtime events produce
 * conversation messages and which belong only in the timeline/logs.
 */

export type ConversationMessageKind =
  | 'goal-stated'
  | 'classified'
  | 'plan-ready'
  | 'started'
  | 'inspecting'
  | 'implementing'
  | 'changes-made'
  | 'verification-starting'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'approval-required';

export interface ConversationMessage {
  readonly kind: ConversationMessageKind;
  readonly role: 'assistant';
  readonly text: string;
  readonly at: string;
}

interface FilterRule {
  readonly eventTypes: readonly string[];
  readonly kind: ConversationMessageKind;
  readonly text: (detail?: string, name?: string) => string;
}

/**
 * Rules for which events produce conversation messages.
 * Each rule maps one or more raw event types to a conversational output.
 */
const CONVERSATION_RULES: readonly FilterRule[] = [
  {
    eventTypes: ['requested'],
    kind: 'goal-stated',
    text: (detail) => `Goal: ${detail ?? 'unknown'}`,
  },
  {
    eventTypes: ['intent-resolved'],
    kind: 'classified',
    text: (detail) => `Classified as ${detail ?? 'standard'} complexity.`,
  },
  {
    eventTypes: ['plan-composed'],
    kind: 'plan-ready',
    text: (detail) => `Plan ready. ${detail ?? ''}`.trim(),
  },
  {
    eventTypes: ['execution-started'],
    kind: 'started',
    text: () => 'Starting implementation...',
  },
  {
    eventTypes: ['context-assembled'],
    kind: 'inspecting',
    text: () => 'Inspecting the repository and assembling context...',
  },
  {
    eventTypes: ['runtime-connected'],
    kind: 'implementing',
    text: () => 'Connected to runtime. Implementing...',
  },
  {
    eventTypes: ['file-changed'],
    kind: 'changes-made',
    text: (detail) => `Updated: ${detail ?? 'files changed'}`,
  },
  {
    eventTypes: ['verification-started'],
    kind: 'verification-starting',
    text: () => 'Verification is starting...',
  },
  {
    eventTypes: ['execution-completed'],
    kind: 'completed',
    text: (detail) => `Implementation complete. ${detail ?? ''}`.trim(),
  },
  {
    eventTypes: ['execution-failed'],
    kind: 'failed',
    text: (detail) => `Execution failed: ${detail ?? 'unknown error'}`,
  },
  {
    eventTypes: ['execution-cancelled'],
    kind: 'cancelled',
    text: () => 'Execution cancelled.',
  },
  {
    eventTypes: ['tool-requested'],
    kind: 'approval-required',
    text: (detail, name) => `Approval required for: ${name ?? detail ?? 'operation'}`,
  },
];

/**
 * Determine if a raw event type should produce a conversation message.
 */
export function shouldProduceMessage(eventType: string): boolean {
  return CONVERSATION_RULES.some((rule) => rule.eventTypes.includes(eventType));
}

/**
 * Map a raw event to a conversation message.
 * Returns null if the event should not produce a conversation message.
 */
export function toConversationMessage(
  eventType: string,
  detail?: string,
  name?: string,
  at?: string,
): ConversationMessage | null {
  const rule = CONVERSATION_RULES.find((r) => r.eventTypes.includes(eventType));
  if (!rule) return null;

  return {
    kind: rule.kind,
    role: 'assistant',
    text: rule.text(detail, name),
    at: at ?? new Date().toISOString(),
  };
}

/**
 * Filter a batch of raw events to conversation-worthy messages.
 * Deduplicates by kind (only the first event of each kind produces a message).
 */
export function filterConversationMessages(
  events: readonly { type: string; detail?: string; name?: string; at: string }[],
): readonly ConversationMessage[] {
  const seen = new Set<ConversationMessageKind>();
  const messages: ConversationMessage[] = [];

  for (const event of events) {
    const msg = toConversationMessage(event.type, event.detail, event.name, event.at);
    if (msg && !seen.has(msg.kind)) {
      seen.add(msg.kind);
      messages.push(msg);
    }
  }

  return messages;
}
