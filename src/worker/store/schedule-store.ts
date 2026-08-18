import { conflict, notFound } from '../../core/errors.js';
import type { Schedule } from '../contracts.js';

export interface ScheduleStore {
  add<TPayload = unknown>(schedule: Schedule<TPayload>): Schedule<TPayload>;
  get(id: string): Schedule;
  update<TPayload = unknown>(schedule: Schedule<TPayload>): Schedule<TPayload>;
  remove(id: string): Schedule;
  list(): readonly Schedule[];
  count(): number;
}

export class InMemoryScheduleStore implements ScheduleStore {
  private readonly schedules = new Map<string, Schedule>();

  add<TPayload = unknown>(schedule: Schedule<TPayload>): Schedule<TPayload> {
    if (this.schedules.has(schedule.id)) throw conflict(`Schedule "${schedule.id}" already exists`);
    this.schedules.set(schedule.id, schedule);
    return schedule;
  }

  get(id: string): Schedule {
    const schedule = this.schedules.get(id);
    if (!schedule) throw notFound(`Schedule "${id}" not found`);
    return schedule;
  }

  update<TPayload = unknown>(schedule: Schedule<TPayload>): Schedule<TPayload> {
    if (!this.schedules.has(schedule.id)) throw notFound(`Schedule "${schedule.id}" not found`);
    this.schedules.set(schedule.id, schedule);
    return schedule;
  }

  remove(id: string): Schedule {
    const schedule = this.schedules.get(id);
    if (!schedule) throw notFound(`Schedule "${id}" not found`);
    this.schedules.delete(id);
    return schedule;
  }

  list(): readonly Schedule[] {
    return [...this.schedules.values()].sort((a, b) => {
      const aNext = a.nextRunAt ?? '';
      const bNext = b.nextRunAt ?? '';
      const byNext = aNext.localeCompare(bNext);
      if (byNext !== 0) return byNext;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }

  count(): number {
    return this.schedules.size;
  }
}
