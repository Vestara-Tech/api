import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events.js';
import { InMemoryJobStore, InMemoryScheduleStore, CronParser, ScheduleLoop, WorkerService, type Schedule } from '../../src/worker/index.js';

describe('WKR-008 cron parser', () => {
  it('parses wildcards, ranges, steps, and lists', () => {
    const parser = new CronParser();
    const expression = parser.parse('*/5 1-3 1,15 * 1-5');

    expect(expression.matches(new Date('2026-08-03T01:10:00.000Z'))).toBe(true);
    expect(expression.matches(new Date('2026-08-02T01:11:00.000Z'))).toBe(false);
    expect(expression.matches(new Date('2026-08-02T04:10:00.000Z'))).toBe(false);
  });

  it('computes the next run after a given instant', () => {
    const parser = new CronParser();
    const next = parser.nextRunAt('0 * * * *', new Date('2026-08-17T12:34:00.000Z'));
    expect(next?.toISOString()).toBe('2026-08-17T13:00:00.000Z');
  });
});

describe('WKR-008 schedule evaluation and loop', () => {
  it('evaluates due schedules, skips disabled ones, and updates run timestamps', async () => {
    const jobs = new InMemoryJobStore();
    const schedules = new InMemoryScheduleStore();
    const loop = new ScheduleLoop({ scheduleStore: schedules, jobStore: jobs, config: { scheduleTickMs: 10, retry: { policy: 'none', delayMs: 0, maxAttempts: 1, maxDelayMs: 0 } } });

    const now = Date.now();
    const due: Schedule = schedules.add({
      id: 'sch_due',
      name: 'cleanup',
      cron: '*/1 * * * *',
      enabled: true,
      binding: { jobType: 'worker.cleanup', payload: { area: 'tmp' }, metadata: { origin: 'test' } },
      createdAt: new Date(now - 5_000).toISOString(),
      updatedAt: new Date(now - 5_000).toISOString(),
      metadata: { origin: 'test' },
      nextRunAt: new Date(now - 1_000).toISOString(),
    });
    const disabled: Schedule = schedules.add({
      id: 'sch_disabled',
      name: 'disabled',
      cron: '*/1 * * * *',
      enabled: false,
      binding: { jobType: 'worker.disabled', payload: {} },
      createdAt: new Date(now - 5_000).toISOString(),
      updatedAt: new Date(now - 5_000).toISOString(),
      metadata: {},
      nextRunAt: new Date(now - 1_000).toISOString(),
    });

    expect(loop.snapshot().scheduleCount).toBe(2);
    expect(loop.listSchedules()).toHaveLength(2);
    expect(loop.removeSchedule(disabled.id).id).toBe(disabled.id);
    expect(loop.listSchedules()).toHaveLength(1);

    const result = await loop.tick();
    expect(result).toBe(1);

    const schedule = loop.listSchedules()[0]!;
    expect(schedule.id).toBe(due.id);
    expect(schedule.lastRunAt).toBeTruthy();
    expect(schedule.nextRunAt).toBeTruthy();
    expect(jobs.list({ type: 'worker.cleanup' })).toHaveLength(1);
    expect(jobs.list({ type: 'worker.cleanup' })[0]!.source).toBe('schedule');
    expect(jobs.list({ type: 'worker.cleanup' })[0]!.scheduleId).toBe(due.id);
  });

  it('works through the worker service schedule facade', async () => {
    const service = new WorkerService({ config: { scheduleTickMs: 10, pollIntervalMs: 10, concurrency: 1, retry: { policy: 'none', delayMs: 0, maxAttempts: 1, maxDelayMs: 0 } } });
    const events = new EventBus();
    void events;

    const schedule = service.addSchedule({
      name: 'system health',
      cron: '*/1 * * * *',
      binding: { jobType: 'system.health-check', payload: { mode: 'summary' } },
    });

    expect(service.listSchedules()).toHaveLength(1);
    expect(service.stats().schedules.total).toBe(1);
    expect(schedule.enabled).toBe(true);
    expect(schedule.nextRunAt).toBeTruthy();

    const removed = service.removeSchedule(schedule.id);
    expect(removed.id).toBe(schedule.id);
    expect(service.listSchedules()).toHaveLength(0);
  });
});
