import { randomId } from '../../core/identifiers.js';
import type { Job, JobError, JobHandler, WorkerConfig } from '../contracts.js';
import { resolveWorkerConfig } from '../contracts.js';
import type { JobStore } from '../store/job-store.js';
import { RetryCalculator } from '../domain/retry.js';

export interface WorkerLoopOptions {
  readonly store: JobStore;
  readonly config?: Partial<WorkerConfig>;
  readonly retryCalculator?: RetryCalculator;
}

export interface WorkerLoopSnapshot {
  readonly running: boolean;
  readonly handlers: number;
  readonly concurrency: number;
  readonly pollIntervalMs: number;
  readonly lastTickAt?: string;
}

function normalizeError(error: unknown): JobError {
  if (error && typeof error === 'object') {
    const candidate = error as { code?: unknown; message?: unknown };
    if (typeof candidate.message === 'string' && typeof candidate.code === 'string') {
      return { code: candidate.code, message: candidate.message };
    }
    if (typeof candidate.message === 'string') {
      return { code: 'WORKER_JOB_FAILED', message: candidate.message };
    }
  }

  if (error instanceof Error) {
    return { code: 'WORKER_JOB_FAILED', message: error.message };
  }

  return { code: 'WORKER_JOB_FAILED', message: 'Worker job failed' };
}

/**
 * WKR-005 — Poll/claim/execute loop.
 *
 * The loop claims pending jobs, executes up to `concurrency` jobs per poll,
 * and either completes them or schedules a retry according to the configured
 * retry policy. It never throws on unknown job types; unknown handlers are
 * converted into failed jobs.
 */
export class WorkerLoop {
  private readonly store: JobStore;
  private readonly config: WorkerConfig;
  private readonly retryCalculator: RetryCalculator;
  private readonly handlers = new Map<string, JobHandler>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private inFlight: Promise<void> | null = null;
  private tickStartedAt?: string;

  constructor(options: WorkerLoopOptions) {
    this.store = options.store;
    this.config = resolveWorkerConfig(options.config);
    this.retryCalculator = options.retryCalculator ?? new RetryCalculator();
  }

  registerHandler<TPayload = unknown, TResult = unknown>(jobType: string, handler: JobHandler<TPayload, TResult>): void {
    this.handlers.set(jobType, handler as JobHandler);
  }

  unregisterHandler(jobType: string): void {
    this.handlers.delete(jobType);
  }

  handlerCount(): number {
    return this.handlers.size;
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  snapshot(): WorkerLoopSnapshot {
    return {
      running: this.isRunning(),
      handlers: this.handlerCount(),
      concurrency: this.config.concurrency,
      pollIntervalMs: this.config.pollIntervalMs,
      ...(this.tickStartedAt !== undefined ? { lastTickAt: this.tickStartedAt } : {}),
    };
  }

  start(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.config.pollIntervalMs);
    void this.tick();
  }

  async stop(): Promise<void> {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.inFlight !== null) {
      await this.inFlight;
    }
  }

  async tick(): Promise<void> {
    if (this.inFlight !== null) {
      return this.inFlight;
    }

    const run = this.runTick();
    this.inFlight = run.finally(() => {
      this.tickStartedAt = new Date().toISOString();
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async runTick(): Promise<void> {
    const started: Promise<void>[] = [];

    while (started.length < this.config.concurrency) {
      const job = this.store.claim(['pending']);
      if (!job) break;
      started.push(this.execute(job));
    }

    if (started.length === 0) return;
    await Promise.all(started);
  }

  private async execute(job: Job): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      this.store.complete(job.id, {
        error: {
          code: 'WORKER_HANDLER_NOT_FOUND',
          message: `No handler registered for job type "${job.type}"`,
        },
      });
      return;
    }

    try {
      const output = await handler(job);
      this.store.complete(job.id, { output });
    } catch (error) {
      await this.handleFailure(job, normalizeError(error));
    }
  }

  private async handleFailure(job: Job, error: JobError): Promise<void> {
    if (job.attempts >= job.maxAttempts || this.config.retry.policy === 'none') {
      this.store.complete(job.id, { error });
      return;
    }

    const nextRetryAt = this.retryCalculator.nextRetryAt(
      new Date(),
      this.config.retry.policy,
      job.attempts,
      this.config.retry.delayMs,
      this.config.retry.maxDelayMs,
    );

    if (nextRetryAt === null) {
      this.store.complete(job.id, { error });
      return;
    }

    this.store.retry(job.id, nextRetryAt, error);
  }
}
