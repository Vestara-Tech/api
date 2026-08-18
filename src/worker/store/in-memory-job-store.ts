import { randomId } from '../../core/identifiers.js';
import { badRequest, notFound } from '../../core/errors.js';
import { JobLifecycle } from '../domain/lifecycle.js';
import { DEFAULT_WORKER_CONFIG, resolveWorkerConfig, type EnqueueJobInput, type Job, type JobCompletion, type JobError, type JobFilter, type JobMetadata, type JobStatus, type WorkerConfig } from '../contracts.js';
import type { JobStore } from './job-store.js';

interface InMemoryJobStoreOptions {
  readonly config?: Partial<WorkerConfig>;
  readonly lifecycle?: JobLifecycle;
}

function toIso(value: string | Date): string {
  return typeof value === 'string' ? value : value.toISOString();
}

function nowIso(): string {
  return new Date().toISOString();
}

function compareIso(a: string, b: string): number {
  return a.localeCompare(b);
}

function isTerminal(status: JobStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

function matchesFilter(job: Job, filter?: JobFilter): boolean {
  if (!filter) return true;
  if (filter.status && job.status !== filter.status) return false;
  if (filter.type && job.type !== filter.type) return false;
  if (filter.source && job.source !== filter.source) return false;
  if (filter.scheduleId && job.scheduleId !== filter.scheduleId) return false;
  if (filter.eventType && job.eventType !== filter.eventType) return false;
  return true;
}

function isClaimable(job: Job, statuses: readonly JobStatus[], now: string): boolean {
  if (compareIso(job.availableAt, now) > 0) return false;
  if (statuses.includes(job.status)) return true;
  return job.status === 'retrying' && statuses.includes('pending');
}

function completionToFailure(completion?: JobCompletion): JobError | undefined {
  if (!completion?.error) return undefined;
  return completion.error;
}

export class InMemoryJobStore implements JobStore {
  private readonly jobs = new Map<string, Job>();
  private readonly lifecycle: JobLifecycle;
  private readonly config: WorkerConfig;

  constructor(options: InMemoryJobStoreOptions = {}) {
    this.lifecycle = options.lifecycle ?? JobLifecycle.standard();
    this.config = resolveWorkerConfig(options.config);
  }

  enqueue<TPayload = unknown, TMetadata extends JobMetadata = JobMetadata>(
    input: EnqueueJobInput<TPayload, TMetadata>,
  ): Job<TPayload, TMetadata> {
    const now = nowIso();
    const job: Job<TPayload, TMetadata> = {
      id: randomId('job'),
      type: input.type,
      source: input.source ?? 'manual',
      status: 'pending',
      payload: input.payload,
      attempts: 0,
      maxAttempts: input.maxAttempts ?? this.config.retry.maxAttempts,
      availableAt: input.availableAt !== undefined ? toIso(input.availableAt) : now,
      createdAt: now,
      updatedAt: now,
      metadata: (input.metadata ?? {}) as TMetadata,
      ...(input.scheduleId !== undefined ? { scheduleId: input.scheduleId } : {}),
      ...(input.eventType !== undefined ? { eventType: input.eventType } : {}),
      ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
    };
    this.jobs.set(job.id, job);
    return job;
  }

  claim(statuses: readonly JobStatus[] = ['pending']): Job | null {
    const now = nowIso();
    const candidates = [...this.jobs.values()]
      .filter((job) => isClaimable(job, statuses, now))
      .sort((a, b) => compareIso(a.availableAt, b.availableAt) || compareIso(a.createdAt, b.createdAt));

    const job = candidates[0];
    if (!job) return null;

    const updated: Job = {
      ...job,
      status: this.lifecycle.transition(job.status, 'running'),
      attempts: job.attempts + 1,
      startedAt: now,
      updatedAt: now,
    };
    this.jobs.set(updated.id, updated);
    return updated;
  }

  complete(id: string, completion?: JobCompletion): Job {
    const job = this.get(id);
    if (job.status !== 'running') {
      throw badRequest(`Cannot complete job "${id}" while it is ${job.status}`);
    }

    const now = nowIso();
    const failure = completionToFailure(completion);
    const status = failure ? this.lifecycle.transition(job.status, 'failed') : this.lifecycle.transition(job.status, 'completed');
    const updated: Job = {
      ...job,
      status,
      updatedAt: now,
      ...(failure ? { failedAt: now, lastError: failure } : { completedAt: now }),
      ...(completion?.output !== undefined ? { result: completion.output } : {}),
    };
    this.jobs.set(updated.id, updated);
    return updated;
  }

  retry(id: string, nextRetryAt: string | Date, error?: JobError): Job {
    const job = this.get(id);
    if (job.status !== 'running' && job.status !== 'failed' && job.status !== 'retrying') {
      throw badRequest(`Cannot retry job "${id}" while it is ${job.status}`);
    }

    const now = nowIso();
    const updated: Job = {
      ...job,
      ...(job.status !== 'retrying' ? { status: this.lifecycle.transition(job.status, 'retrying') } : {}),
      availableAt: toIso(nextRetryAt),
      updatedAt: now,
      ...(error !== undefined ? { lastError: error } : {}),
    };
    this.jobs.set(updated.id, updated);
    return updated;
  }

  cancel(id: string, reason?: string): Job {
    const job = this.get(id);
    if (job.status !== 'pending' && job.status !== 'retrying') {
      throw badRequest(`Cannot cancel job "${id}" while it is ${job.status}`);
    }

    const now = nowIso();
    const updated: Job = {
      ...job,
      status: this.lifecycle.transition(job.status, 'cancelled'),
      updatedAt: now,
      cancelledAt: now,
      ...(reason !== undefined ? { cancelReason: reason } : {}),
    };
    this.jobs.set(updated.id, updated);
    return updated;
  }

  get(id: string): Job {
    const job = this.jobs.get(id);
    if (!job) throw notFound(`Job "${id}" not found`);
    return job;
  }

  list(filter?: JobFilter): readonly Job[] {
    return [...this.jobs.values()]
      .filter((job) => matchesFilter(job, filter))
      .sort((a, b) => compareIso(b.createdAt, a.createdAt));
  }

  count(filter?: JobFilter): number {
    return this.list(filter).length;
  }

  purgeCompleted(before: string | Date): number {
    const threshold = toIso(before);
    let removed = 0;

    for (const job of this.jobs.values()) {
      if (job.status !== 'completed') continue;
      const completedAt = job.completedAt ?? job.updatedAt;
      if (compareIso(completedAt, threshold) >= 0) continue;
      this.jobs.delete(job.id);
      removed += 1;
    }

    return removed;
  }
}

export { DEFAULT_WORKER_CONFIG };
