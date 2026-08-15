/** BLD-X v2 — BuilderSession / DefinitionDraft / unified builder lifecycle. */

import { randomId } from '../core/identifiers.js';
import type { BuilderDefinition, BuilderDefinitionStatus } from './contracts.js';
import type { BuilderStore } from './store.js';
import type { BuilderRegistry } from './registry.js';
import type { BuilderLifecycle } from './lifecycle.js';

export interface BuilderSessionState {
  readonly sessionId: string;
  readonly draftId: string;
  readonly status: 'editing' | 'validated' | 'previewing' | 'testing' | 'published' | 'discarded';
  readonly startedAt: string;
  readonly lastEditedAt: string;
}

export interface BuilderSessionOptions<TKind extends string = string, TSpec = unknown> {
  readonly kind: TKind;
  readonly base?: BuilderDefinition<TKind, TSpec>;
}

/**
 * BLD-X v2 — BuilderSession. One shared lifecycle across every builder
 * (Agent, API, Page, Application, Dashboard, Theme, Template):
 * create -> configure -> validate -> preview -> test -> publish -> version
 * -> clone -> export. Builders edit drafts; generators produce artifacts.
 */
export class BuilderSession<TKind extends string = string, TSpec = unknown> {
  private session: BuilderSessionState;
  private draft: BuilderDefinition<TKind, TSpec>;
  private readonly kind: TKind;
  private readonly operations: number[] = [];

  constructor(options: BuilderSessionOptions<TKind, TSpec>) {
    const now = new Date().toISOString();
    this.kind = options.kind;
    this.session = {
      sessionId: randomId('session'),
      draftId: randomId('draft'),
      status: 'editing',
      startedAt: now,
      lastEditedAt: now,
    };
    this.draft = options.base
      ? { ...options.base, status: 'draft' }
      : ({
          id: randomId('def'),
          kind: options.kind,
          name: '',
          revision: 0,
          status: 'draft',
          spec: {},
          metadata: { createdAt: now, updatedAt: now },
        } as BuilderDefinition<TKind, TSpec>);
  }

  getSession(): BuilderSessionState {
    return this.session;
  }

  getDraft(): BuilderDefinition<TKind, TSpec> {
    return this.draft;
  }

  /** configure — patch the draft spec. */
  configure(spec: TSpec): BuilderDefinition<TKind, TSpec> {
    this.draft = { ...this.draft, spec, metadata: { ...this.draft.metadata, updatedAt: new Date().toISOString() } };
    this.operations.push(this.operations.length);
    this.session = { ...this.session, lastEditedAt: new Date().toISOString() };
    return this.draft;
  }

  validate(): BuilderDefinition<TKind, TSpec> {
    this.session = { ...this.session, status: 'validated' };
    return this.draft;
  }

  preview(): BuilderDefinition<TKind, TSpec> {
    this.session = { ...this.session, status: 'previewing' };
    return this.draft;
  }

  test(): BuilderDefinition<TKind, TSpec> {
    this.session = { ...this.session, status: 'testing' };
    return this.draft;
  }

  /** publish — freeze the draft. */
  publish(): BuilderDefinition<TKind, TSpec> {
    this.session = { ...this.session, status: 'published' };
    return { ...this.draft, status: 'published', revision: this.draft.revision + 1 };
  }

  clone(): BuilderDefinition<TKind, TSpec> {
    const now = new Date().toISOString();
    return {
      ...this.draft,
      id: randomId('def'),
      name: `${this.draft.name} (copy)`,
      revision: 0,
      status: 'draft',
      metadata: { ...this.draft.metadata, createdAt: now, updatedAt: now },
    };
  }

  /** export — the canonical artifact the generator consumes. */
  export(): BuilderDefinition<TKind, TSpec> {
    return this.draft;
  }

  operationCount(): number {
    return this.operations.length;
  }
}

/**
 * BLD-X v2 — BuilderPlane service. Routes sessions through the shared
 * lifecycle: validate via the contribution validator, publish via the
 * BuilderLifecycle, store drafts and published definitions.
 */
export class BuilderPlane<TKind extends string = string> {
  private readonly store: BuilderStore;
  private readonly registry: BuilderRegistry;
  private readonly lifecycle: BuilderLifecycle;
  private readonly sessions = new Map<string, BuilderSession<TKind, unknown>>();

  constructor(store: BuilderStore, registry: BuilderRegistry, lifecycle: BuilderLifecycle) {
    this.store = store;
    this.registry = registry;
    this.lifecycle = lifecycle;
  }

  openSession(kind: TKind, baseId?: string): BuilderSession<TKind, unknown> {
    let base: BuilderDefinition<TKind, unknown> | undefined;
    if (baseId) base = this.store.get<TKind, unknown>(baseId);
    const session = new BuilderSession<TKind, unknown>({ kind, ...(base ? { base } : {}) });
    this.sessions.set(session.getSession().sessionId, session);
    return session;
  }

  getSession(sessionId: string): BuilderSession<TKind, unknown> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Builder session "${sessionId}" not found`);
    return session;
  }

  /** validate the session draft against its contribution validator. */
  validateDraft(sessionId: string) {
    const session = this.getSession(sessionId);
    const draft = session.getDraft();
    const contribution = this.registry.resolve<unknown>(draft.kind);
    const result = contribution.validator.validate(draft.spec);
    if (result.ok) session.validate();
    return result;
  }

  /** publish the session draft into the shared store + lifecycle. */
  publishSession(sessionId: string): BuilderDefinition<TKind, unknown> {
    const session = this.getSession(sessionId);
    const draft = session.publish();
    const saved = this.store.save<TKind, unknown>({ ...draft, status: 'draft' });
    return this.lifecycle.publish<TKind, unknown>(saved.id);
  }

  listDrafts(kind?: string): readonly BuilderDefinition[] {
    return this.store.list(kind);
  }

  discard(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  activeSessions(): readonly BuilderSessionState[] {
    return [...this.sessions.values()].map((s) => s.getSession());
  }
}
