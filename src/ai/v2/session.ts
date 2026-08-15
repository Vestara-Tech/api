/** AI2-011 — Durable AI session / conversation runtime. */

import { randomId } from '../../core/identifiers.js';
import type { AiMessage } from '../domain/contracts.js';
import type { RoutingDecision } from './router-v2.js';

export interface AiSession {
  readonly id: string;
  readonly consumerId: string;
  readonly profileId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly title?: string;
  readonly requestCount: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCostUsd: number;
}

export interface AiConversation {
  readonly id: string;
  readonly sessionId: string;
  readonly messages: readonly AiMessage[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AiSessionStorePort {
  saveSession(session: AiSession): void;
  getSession(id: string): AiSession | undefined;
  listSessions(): readonly AiSession[];
  saveConversation(conversation: AiConversation): void;
  getConversation(id: string): AiConversation | undefined;
  listConversations(sessionId: string): readonly AiConversation[];
}

export class InMemoryAiSessionStore implements AiSessionStorePort {
  private readonly sessions = new Map<string, AiSession>();
  private readonly conversations = new Map<string, AiConversation>();

  saveSession(session: AiSession): void {
    this.sessions.set(session.id, session);
  }

  getSession(id: string): AiSession | undefined {
    return this.sessions.get(id);
  }

  listSessions(): readonly AiSession[] {
    return [...this.sessions.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  saveConversation(conversation: AiConversation): void {
    this.conversations.set(conversation.id, conversation);
  }

  getConversation(id: string): AiConversation | undefined {
    return this.conversations.get(id);
  }

  listConversations(sessionId: string): readonly AiConversation[] {
    return [...this.conversations.values()].filter((c) => c.sessionId === sessionId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}

export interface AiSessionManagerOptions {
  readonly store?: AiSessionStorePort;
}

/**
 * AI2-011 — AI session runtime. Durable sessions own conversations, requests,
 * routing decisions, usage and traces. Activity Room / Agent / Workflow share
 * the same execution history without coupling to provider APIs.
 */
export class AiSessionManager {
  private readonly store: AiSessionStorePort;

  constructor(options: AiSessionManagerOptions = {}) {
    this.store = options.store ?? new InMemoryAiSessionStore();
  }

  createSession(options: { consumerId: string; profileId: string; title?: string }): AiSession {
    const now = new Date().toISOString();
    const session: AiSession = {
      id: randomId('session'),
      consumerId: options.consumerId,
      profileId: options.profileId,
      createdAt: now,
      updatedAt: now,
      ...(options.title !== undefined ? { title: options.title } : {}),
      requestCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
    };
    this.store.saveSession(session);
    return session;
  }

  getSession(id: string): AiSession | undefined {
    return this.store.getSession(id);
  }

  listSessions(): readonly AiSession[] {
    return this.store.listSessions();
  }

  newConversation(sessionId: string): AiConversation {
    const now = new Date().toISOString();
    const conversation: AiConversation = { id: randomId('conv'), sessionId, messages: [], createdAt: now, updatedAt: now };
    this.store.saveConversation(conversation);
    return conversation;
  }

  getConversation(id: string): AiConversation | undefined {
    return this.store.getConversation(id);
  }

  appendMessage(conversationId: string, message: AiMessage): AiConversation {
    const conversation = this.store.getConversation(conversationId);
    if (!conversation) throw new Error(`Conversation "${conversationId}" not found`);
    const next: AiConversation = { ...conversation, messages: [...conversation.messages, message], updatedAt: new Date().toISOString() };
    this.store.saveConversation(next);
    return next;
  }

  listConversations(sessionId: string): readonly AiConversation[] {
    return this.store.listConversations(sessionId);
  }

  /** Record usage after a request; returns the updated session. */
  recordUsage(sessionId: string, usage: { inputTokens: number; outputTokens: number; estimatedCostUsd: number }, decision: RoutingDecision): AiSession {
    const session = this.store.getSession(sessionId);
    if (!session) throw new Error(`Session "${sessionId}" not found`);
    const next: AiSession = {
      ...session,
      requestCount: session.requestCount + 1,
      inputTokens: session.inputTokens + usage.inputTokens,
      outputTokens: session.outputTokens + usage.outputTokens,
      estimatedCostUsd: session.estimatedCostUsd + usage.estimatedCostUsd,
      updatedAt: new Date().toISOString(),
    };
    this.store.saveSession(next);
    return next;
  }
}
