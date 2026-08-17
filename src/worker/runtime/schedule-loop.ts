import { randomId } from '../../core/identifiers.js';
import type { JobStore } from '../store/job-store.js';
import type { WorkerConfig, Schedule, ScheduleInput } from '../contracts.js';
import { resolveWorkerConfig } from '../contracts.js';
import type { ScheduleStore } from '../store/schedule-store.js';
import { CronParser } from '../domain/scheduler.js';

export interface ScheduleLoopOptions {
  readonly scheduleStore: ScheduleStore;
  readonly jobStore: JobStore;
  readonly config?: Partial<WorkerConfig>;
  readonly cronParser?: CronParser;
}

export interface ScheduleLoopSnapshot {
  readonly running: boolean;
  readonly scheduleCount: number;
  readonly pollIntervalMs: number;
  readonly lastTickAt?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * WKR-008 — Recurring schedule evaluation loop.
 */
export class ScheduleLoop {
  private readonly scheduleStore: ScheduleStore;
  private readonly jobStore: JobStore;
  private readonly config: WorkerConfig;
  private readonly parser: CronParser;
  private timer: ReturnType<typeof setInterval> | null = null;
  private inFlight: Promise<number> | null = null;
  private tickCompletedAt?: string;

  constructor(options: ScheduleLoopOptions) {
    this.scheduleStore = options.scheduleStore;
    this.jobStore = options.jobStore;
    this.config = resolveWorkerConfig(options.config);
    this.parser = options.cronParser ?? new CronParser();
  }

  snapshot(): ScheduleLoopSnapshot {
    return {
      running: this.timer !== null,
      scheduleCount: this.scheduleStore.count(),
      pollIntervalMs: this.config.scheduleTickMs,
      ...(this.tickCompletedAt !== undefined ? { lastTickAt: this.tickCompletedAt } : {}),
    };
  }

  start(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.config.scheduleTickMs);
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

  async tick(): Promise<number> {
    if (this.inFlight !== null) return this.inFlight;
    const run = this.runTick();
    this.inFlight = run.finally(() => {
      this.tickCompletedAt = nowIso();
      this.inFlight = null;
    });
    return this.inFlight;
  }

  addSchedule<TPayload = unknown>(input: ScheduleInput<TPayload>): Schedule<TPayload> {
    const createdAt = nowIso();
    const cron = this.parser.parse(input.cron);
    const nextRun = cron.nextAfter(new Date());
    const schedule: Schedule<TPayload> = {
      id: input.id ?? randomId('sch'),
      name: input.name,
      cron: input.cron,
      enabled: input.enabled ?? true,
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      binding: { ...input.binding },
      ...(nextRun !== null ? { nextRunAt: nextRun.toISOString() } : {}),
      createdAt,
      updatedAt: createdAt,
      metadata: input.metadata ?? {},
    };
    return this.scheduleStore.add(schedule);
  }

  removeSchedule(id: string): Schedule {
    return this.scheduleStore.remove(id);
  }

  listSchedules(): readonly Schedule[] {
    return this.scheduleStore.list();
  }

  private async runTick(): Promise<number> {
    const now = new Date();
    const due = this.scheduleStore.list().filter((schedule) => this.parser.isDue(schedule, now));
    let enqueued = 0;

    for (const schedule of due) {
      const job = this.jobStore.enqueue({
        type: schedule.binding.jobType,
        payload: schedule.binding.payload,
        source: 'schedule',
        ...(schedule.binding.maxAttempts !== undefined ? { maxAttempts: schedule.binding.maxAttempts } : {}),
        metadata: {
          ...schedule.metadata,
          ...(schedule.binding.metadata ?? {}),
          scheduleId: schedule.id,
          scheduleName: schedule.name,
        },
        scheduleId: schedule.id,
      });
      void job;

      const nextRun = this.parser.nextRunAt(schedule.cron, now);
      this.scheduleStore.update({
        ...schedule,
        lastRunAt: nowIso(),
        ...(nextRun !== null ? { nextRunAt: nextRun.toISOString() } : {}),
        updatedAt: nowIso(),
      });
      enqueued += 1;
    }

    return enqueued;
  }
}
