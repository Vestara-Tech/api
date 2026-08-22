/**
 * DEX-CP3.1 / ARX-014 — Runtime session lifecycle + resource guardrails.
 *
 * Two session identity models:
 *
 *   SIMPLE path (DEX): keyed by (executionId, agentRunId). One execution
 *   owns one durable CAR session. Subsequent steps, tool continuations,
 *   retries, verification fixes, and workflow continuation reuse that
 *   session unless an explicit session-boundary policy requires a new one.
 *
 *   WORKFLOW path (ARX-014): keyed by (workflowRunId, agentAssignmentId,
 *   runtimeId). Multiple Developer turns in the same governed workflow
 *   resolve to the same binding. The agentAssignmentId is deterministic
 *   per workflow definition (e.g. "developer-primary"), NOT a UUID per
 *   step execution.
 *
 * Capacity vs Retention:
 *
 *   Capacity = whether a new active session may be acquired. When
 *   capacity is exhausted, the request is queued/blocked — never
 *   creates a second session anyway.
 *
 *   Retention = how long a completed/suspended binding remains
 *   resumable. This is separate from capacity and controlled by
 *   sessionIdleTimeoutMs + retentionTimeoutMs.
 *
 * Ownership lives ABOVE the OpenCode adapter: the registry binds an
 * execution/workflow to a runtime session id, so the orchestration
 * layer can resume instead of recreating.
 *
 * PERSISTENCE CAVEAT: this registry is in-memory by design. A restart
 * loses bindings; Activity Room restart recovery is therefore a future
 * durable store (the Activity history store) concern. This is an
 * explicit limitation.
 */

import type { CodingAgentRuntimeId } from '../domain/contracts.js';
import { mergeEnvironment } from '../../config/environment.js';

/** ARX-014 — Thrown when session capacity is exhausted. Callers catch and convert to governed state. */
export class CapacityExhaustedError extends Error {
  readonly code = 'CAPACITY_EXHAUSTED';
  constructor(message: string) {
    super(message);
    this.name = 'CapacityExhaustedError';
  }
}

export type RuntimeSessionStatus = 'active' | 'suspended' | 'completed' | 'failed';

/** DEX-CP3.1 / ARX-014 — Persistent association between an execution/workflow and its CAR session. */
export interface RuntimeSessionBinding {
  // Identity — one of these key models applies:
  //   DEX:      executionId + agentRunId
  //   Workflow: workflowRunId + agentAssignmentId + runtimeId
  readonly executionId: string;
  readonly agentRunId: string;
  readonly workflowRunId?: string;
  readonly agentAssignmentId?: string;
  readonly runtime: CodingAgentRuntimeId | string;
  readonly sessionId: string;
  readonly providerSessionId: string;
  readonly createdAt: string;
  lastUsedAt: string;
  status: RuntimeSessionStatus;
  /** Total uses of the binding: 1 create + N resumes. */
  readonly uses: number;
  /** Number of createSession calls that produced a session (must be 1). */
  readonly createdCount: number;
  /** Number of times an existing session was resumed. */
  readonly resumedCount: number;
  readonly model?: string;
}

export interface RuntimeSessionLimits {
  /** Maximum concurrent active CAR sessions across all executions/workflows. */
  readonly maxActiveSessions: number;
  /** Maximum active sessions per execution (DEX path). The invariant requires 1. */
  readonly maxSessionsPerExecution: number;
  /** Maximum active sessions per workflow (ARX-014). The invariant requires 1 per (workflow, assignment). */
  readonly maxActiveSessionsPerWorkflow: number;
  /** Idle time after which an active session is finalized to free capacity. */
  readonly sessionIdleTimeoutMs: number;
  /** Time after completion/suspension before a binding is eligible for retention sweep. */
  readonly retentionTimeoutMs: number;
  /** Bounded verification-fix iterations per execution (reuses the same session). */
  readonly maxFixAttempts: number;
}

/** Load session guardrails from environment with safe defaults. */
export function loadSessionLimits(
  env: NodeJS.ProcessEnv = typeof process !== 'undefined' ? mergeEnvironment() : {},
): RuntimeSessionLimits {
  const parse = (value: string | undefined, fallback: number): number => {
    const n = value === undefined ? Number.NaN : Number(value);
    return Number.isInteger(n) && n > 0 ? n : fallback;
  };
  return {
    maxActiveSessions: parse(env.CAR_MAX_ACTIVE_SESSIONS, 2),
    maxSessionsPerExecution: parse(env.CAR_MAX_SESSIONS_PER_EXECUTION, 1),
    maxActiveSessionsPerWorkflow: parse(env.CAR_MAX_SESSIONS_PER_WORKFLOW, 1),
    sessionIdleTimeoutMs: parse(env.CAR_SESSION_IDLE_TIMEOUT_MS, 900_000),
    retentionTimeoutMs: parse(env.CAR_RETENTION_TIMEOUT_MS, 3_600_000),
    maxFixAttempts: parse(env.CAR_MAX_FIX_ATTEMPTS, 1),
  };
}

export interface RuntimeSessionFactory {
  readonly runtime: CodingAgentRuntimeId | string;
  readonly model?: string;
  create(): Promise<{ readonly sessionId: string; readonly providerSessionId: string }>;
}

export interface RuntimeSessionAcquired {
  readonly binding: RuntimeSessionBinding;
  readonly created: boolean;
}

/** ARX-014 — Workflow context for session binding. When provided, the session
 *  is keyed by (workflowRunId, agentAssignmentId, runtimeId) instead of
 *  (executionId, agentRunId). */
export interface WorkflowSessionContext {
  readonly workflowRunId: string;
  readonly agentAssignmentId: string;
  readonly runtimeId: string;
}

export interface RuntimeSessionRegistry {
  get(executionId: string, agentRunId: string): RuntimeSessionBinding | undefined;
  touch(executionId: string, agentRunId: string): void;
  complete(executionId: string, agentRunId: string): void;
  fail(executionId: string, agentRunId: string): void;
  release(executionId: string, agentRunId: string): Promise<void>;
  activeCount(): number;
  sweepIdle(): Promise<void>;
  /** Atomic get-or-create. Serializes per binding key so concurrent requests yield ONE session. */
  getOrCreate(
    executionId: string,
    agentRunId: string,
    factory: RuntimeSessionFactory,
    finalize?: (sessionId: string) => Promise<void>,
    workflowContext?: WorkflowSessionContext,
  ): Promise<RuntimeSessionAcquired>;
}

export class InMemoryRuntimeSessionRegistry implements RuntimeSessionRegistry {
  private readonly bindings = new Map<string, RuntimeSessionBinding>();
  private readonly creationChains = new Map<string, Promise<RuntimeSessionAcquired>>();
  private readonly waiters: Array<() => void> = [];
  private readonly finalizers = new Map<string, (sessionId: string) => Promise<void>>();
  private readonly limits: RuntimeSessionLimits;

  constructor(limits?: Partial<RuntimeSessionLimits>) {
    this.limits = { ...loadSessionLimits(), ...limits };
  }

  private key(executionId: string, agentRunId: string, workflowContext?: WorkflowSessionContext): string {
    if (workflowContext !== undefined) {
      return `wf:${workflowContext.workflowRunId}:${workflowContext.agentAssignmentId}:${workflowContext.runtimeId}`;
    }
    return `${executionId}:${agentRunId}`;
  }

  get(executionId: string, agentRunId: string): RuntimeSessionBinding | undefined {
    return this.bindings.get(this.key(executionId, agentRunId));
  }

  touch(executionId: string, agentRunId: string): void {
    const binding = this.bindings.get(this.key(executionId, agentRunId));
    if (!binding) return;
    binding.lastUsedAt = new Date().toISOString();
    this.bindings.set(this.key(executionId, agentRunId), binding);
  }

  complete(executionId: string, agentRunId: string): void {
    const binding = this.bindings.get(this.key(executionId, agentRunId));
    if (!binding || binding.status === 'completed' || binding.status === 'failed') return;
    binding.status = 'completed';
    binding.lastUsedAt = new Date().toISOString();
    this.bindings.set(this.key(executionId, agentRunId), binding);
    this.signal();
  }

  fail(executionId: string, agentRunId: string): void {
    const binding = this.bindings.get(this.key(executionId, agentRunId));
    if (!binding || binding.status === 'completed' || binding.status === 'failed') return;
    binding.status = 'failed';
    binding.lastUsedAt = new Date().toISOString();
    this.bindings.set(this.key(executionId, agentRunId), binding);
    this.signal();
  }

  async release(executionId: string, agentRunId: string): Promise<void> {
    const binding = this.bindings.get(this.key(executionId, agentRunId));
    if (!binding) return;
    if (binding.status === 'active' || binding.status === 'suspended') {
      binding.status = 'completed';
      this.bindings.set(this.key(executionId, agentRunId), binding);
      this.signal();
    }
  }

  activeCount(): number {
    let count = 0;
    for (const binding of this.bindings.values()) {
      if (binding.status === 'active') count += 1;
    }
    return count;
  }

  /** ARX-014 — Count active sessions for a specific workflow. */
  activeCountForWorkflow(workflowRunId: string): number {
    let count = 0;
    for (const binding of this.bindings.values()) {
      if (binding.status === 'active' && binding.workflowRunId === workflowRunId) count += 1;
    }
    return count;
  }

  async sweepIdle(): Promise<void> {
    const now = Date.now();
    for (const [key, binding] of this.bindings.entries()) {
      if (binding.status !== 'active') continue;
      const idleMs = now - Date.parse(binding.lastUsedAt);
      if (idleMs < this.limits.sessionIdleTimeoutMs) continue;
      const finalize = this.finalizers.get(key);
      if (finalize !== undefined) {
        try {
          await finalize(binding.sessionId);
        } catch {
          // Finalization failure must not poison the registry; the binding is
          // still marked suspended so the capacity slot is reclaimed.
        }
      }
      binding.status = 'suspended';
      binding.lastUsedAt = new Date().toISOString();
      this.bindings.set(key, binding);
      this.signal();
    }
  }

  /** ARX-014 — Sweep completed/suspended bindings past retention timeout. */
  async sweepRetention(): Promise<void> {
    const now = Date.now();
    for (const [key, binding] of this.bindings.entries()) {
      if (binding.status !== 'completed' && binding.status !== 'suspended') continue;
      const retainedMs = now - Date.parse(binding.lastUsedAt);
      if (retainedMs < this.limits.retentionTimeoutMs) continue;
      this.bindings.delete(key);
      this.finalizers.delete(key);
    }
  }

  getOrCreate(
    executionId: string,
    agentRunId: string,
    factory: RuntimeSessionFactory,
    finalize?: (sessionId: string) => Promise<void>,
    workflowContext?: WorkflowSessionContext,
  ): Promise<RuntimeSessionAcquired> {
    const key = this.key(executionId, agentRunId, workflowContext);
    if (finalize !== undefined) this.finalizers.set(key, finalize);
    const previous = this.creationChains.get(key) ?? Promise.resolve();
    const next = previous.then(() => this.getOrCreateUnlocked(executionId, agentRunId, key, factory, workflowContext));
    this.creationChains.set(key, next.catch(() => undefined) as Promise<RuntimeSessionAcquired>);
    return next;
  }

  private async getOrCreateUnlocked(
    executionId: string,
    agentRunId: string,
    key: string,
    factory: RuntimeSessionFactory,
    workflowContext?: WorkflowSessionContext,
  ): Promise<RuntimeSessionAcquired> {
    const existing = this.bindings.get(key);

    if (existing !== undefined) {
      if (existing.status === 'active' || existing.status === 'suspended') {
        // Reuse the owned session identity (resume semantics are the caller's).
        const resumed: RuntimeSessionBinding = {
          ...existing,
          status: 'active',
          lastUsedAt: new Date().toISOString(),
          uses: existing.uses + 1,
          resumedCount: existing.resumedCount + 1,
        };
        this.bindings.set(key, resumed);
        return { binding: resumed, created: false };
      }
      // Terminal binding: an explicit session-boundary policy requires a fresh
      // session for a new lifecycle.
      const created = await this.createBinding(executionId, agentRunId, key, factory, workflowContext);
      return { binding: created, created: true };
    }

    const created = await this.createBinding(executionId, agentRunId, key, factory, workflowContext);
    return { binding: created, created: true };
  }

  private async createBinding(
    executionId: string,
    agentRunId: string,
    key: string,
    factory: RuntimeSessionFactory,
    workflowContext?: WorkflowSessionContext,
  ): Promise<RuntimeSessionBinding> {
    // Capacity guardrail: check without blocking. ARX-014 — Capacity exhaustion
    // is a governed state (runtime-session-capacity-blocked), not a blocking wait.
    // The caller converts CapacityExhaustedError to outcome: 'queued'.
    await this.sweepIdle();
    if (this.activeCount() >= this.limits.maxActiveSessions) {
      throw new CapacityExhaustedError(`Global capacity exhausted: ${this.activeCount()} active sessions`);
    }
    if (workflowContext !== undefined) {
      if (this.activeCountForWorkflow(workflowContext.workflowRunId) >= this.limits.maxActiveSessionsPerWorkflow) {
        throw new CapacityExhaustedError(`Workflow capacity exhausted for "${workflowContext.workflowRunId}"`);
      }
    }

    const session = await factory.create();
    const now = new Date().toISOString();
    const binding: RuntimeSessionBinding = {
      executionId,
      agentRunId,
      ...(workflowContext !== undefined
        ? { workflowRunId: workflowContext.workflowRunId, agentAssignmentId: workflowContext.agentAssignmentId }
        : {}),
      runtime: factory.runtime,
      sessionId: session.sessionId,
      providerSessionId: session.providerSessionId,
      createdAt: now,
      lastUsedAt: now,
      status: 'active',
      uses: 1,
      createdCount: 1,
      resumedCount: 0,
      ...(factory.model !== undefined ? { model: factory.model } : {}),
    };
    this.bindings.set(key, binding);
    return binding;
  }

  private async waitForCapacity(workflowContext?: WorkflowSessionContext): Promise<void> {
    // Reap idle sessions first so capacity is reclaimed without queueing.
    await this.sweepIdle();
    while (this.activeCount() >= this.limits.maxActiveSessions) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
      await this.sweepIdle();
    }
    // ARX-014 — Per-workflow capacity: at most maxActiveSessionsPerWorkflow per workflow.
    if (workflowContext !== undefined) {
      while (this.activeCountForWorkflow(workflowContext.workflowRunId) >= this.limits.maxActiveSessionsPerWorkflow) {
        await new Promise<void>((resolve) => this.waiters.push(resolve));
        await this.sweepIdle();
      }
    }
  }

  private signal(): void {
    if (this.waiters.length === 0) return;
    const waiters = this.waiters.splice(0, this.waiters.length);
    for (const resolve of waiters) resolve();
  }
}
