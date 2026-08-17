import { InMemoryJobStore } from '../store/in-memory-job-store.js';
import type { Job, JobError, JobFilter, JobHandler, JobMetadata, EnqueueJobInput, WorkerConfig, Schedule, ScheduleInput } from '../contracts.js';
import { resolveWorkerConfig } from '../contracts.js';
import type { JobStore } from '../store/job-store.js';
import { WorkerLoop, type WorkerLoopSnapshot } from '../runtime/worker-loop.js';
import { CronParser } from '../domain/scheduler.js';
import { InMemoryScheduleStore, type ScheduleStore } from '../store/schedule-store.js';
import { ScheduleLoop, type ScheduleLoopSnapshot } from '../runtime/schedule-loop.js';

export interface WorkerServiceOptions {
  readonly store?: JobStore;
  readonly config?: Partial<WorkerConfig>;
}

export interface WorkerJobCounts {
  readonly pending: number;
  readonly running: number;
  readonly retrying: number;
  readonly completed: number;
  readonly failed: number;
  readonly cancelled: number;
  readonly total: number;
}

export interface WorkerScheduleCounts {
  readonly total: number;
  readonly enabled: number;
  readonly disabled: number;
}

export interface WorkerStats extends WorkerLoopSnapshot {
  readonly jobs: WorkerJobCounts;
  readonly schedules: WorkerScheduleCounts;
}

/**
 * WKR-006 — Public facade for worker operations.
 */
export class WorkerService {
  private readonly store: JobStore;
  private readonly scheduleStore: ScheduleStore;
  private readonly config: WorkerConfig;
  private readonly loop: WorkerLoop;
  private readonly scheduleLoop: ScheduleLoop;

  constructor(options: WorkerServiceOptions = {}) {
    this.config = resolveWorkerConfig(options.config);
    this.store = options.store ?? new InMemoryJobStore({ config: this.config });
    this.loop = new WorkerLoop({ store: this.store, config: this.config });
    this.scheduleStore = new InMemoryScheduleStore();
    this.scheduleLoop = new ScheduleLoop({
      scheduleStore: this.scheduleStore,
      jobStore: this.store,
      config: this.config,
      cronParser: new CronParser(),
    });
  }

  registerHandler<TPayload = unknown, TResult = unknown>(jobType: string, handler: JobHandler<TPayload, TResult>): void {
    this.loop.registerHandler(jobType, handler);
  }

  unregisterHandler(jobType: string): void {
    this.loop.unregisterHandler(jobType);
  }

  start(): void {
    this.loop.start();
    this.scheduleLoop.start();
  }

  stop(): Promise<void> {
    return this.scheduleLoop.stop().then(() => this.loop.stop());
  }

  tick(): Promise<void> {
    return this.loop.tick();
  }

  tickSchedules(): Promise<number> {
    return this.scheduleLoop.tick();
  }

  enqueue<TPayload = unknown, TMetadata extends JobMetadata = JobMetadata>(
    input: EnqueueJobInput<TPayload, TMetadata>,
  ): Job<TPayload, TMetadata> {
    return this.store.enqueue(input);
  }

  getJob(id: string): Job {
    return this.store.get(id);
  }

  listJobs(filter?: JobFilter): readonly Job[] {
    return this.store.list(filter);
  }

  cancelJob(id: string, reason?: string): Job {
    return this.store.cancel(id, reason);
  }

  retryJob(id: string, nextRetryAt: string | Date, error?: JobError): Job {
    return this.store.retry(id, nextRetryAt, error);
  }

  addSchedule<TPayload = unknown>(input: ScheduleInput<TPayload>): Schedule<TPayload> {
    return this.scheduleLoop.addSchedule(input);
  }

  removeSchedule(id: string): Schedule {
    return this.scheduleLoop.removeSchedule(id);
  }

  listSchedules(): readonly Schedule[] {
    return this.scheduleLoop.listSchedules();
  }

  stats(): WorkerStats {
    const schedules = this.scheduleLoop.snapshot();
    return {
      ...this.loop.snapshot(),
      jobs: {
        pending: this.store.count({ status: 'pending' }),
        running: this.store.count({ status: 'running' }),
        retrying: this.store.count({ status: 'retrying' }),
        completed: this.store.count({ status: 'completed' }),
        failed: this.store.count({ status: 'failed' }),
        cancelled: this.store.count({ status: 'cancelled' }),
        total: this.store.count(),
      },
      schedules: {
        total: schedules.scheduleCount,
        enabled: this.scheduleLoop.listSchedules().filter((schedule) => schedule.enabled).length,
        disabled: this.scheduleLoop.listSchedules().filter((schedule) => !schedule.enabled).length,
      },
    };
  }
}
