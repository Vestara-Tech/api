import { badRequest } from '../../core/errors.js';
import type { Schedule } from '../contracts.js';

interface CronField {
  readonly wildcard: boolean;
  readonly values: ReadonlySet<number>;
}

export interface ParsedCron {
  readonly expression: string;
  readonly minute: CronField;
  readonly hour: CronField;
  readonly dayOfMonth: CronField;
  readonly month: CronField;
  readonly dayOfWeek: CronField;
  matches(date: Date): boolean;
  nextAfter(date: Date): Date | null;
}

function normalizeWeekday(value: number): number {
  return value === 7 ? 0 : value;
}

function buildField(
  raw: string,
  min: number,
  max: number,
  options?: { readonly weekday?: boolean; readonly label?: string },
): CronField {
  const valueSet = new Set<number>();
  let wildcard = false;
  const segments = raw.split(',').map((segment) => segment.trim()).filter(Boolean);

  if (segments.length === 0) throw badRequest(`Invalid cron field${options?.label ? ` for ${options.label}` : ''}: "${raw}"`);

  for (const segment of segments) {
    const [rangePartRaw, stepPart] = segment.split('/');
    const rangePart = rangePartRaw ?? '';
    const step = stepPart !== undefined ? Number(stepPart) : 1;
    if (!Number.isInteger(step) || step <= 0) {
      throw badRequest(`Invalid cron step${options?.label ? ` for ${options.label}` : ''}: "${segment}"`);
    }

    let start = min;
    let end = max;

    if (rangePart === '*') {
      wildcard = true;
    } else if (rangePart.includes('-')) {
      const [startRaw, endRaw] = rangePart.split('-');
      start = Number(startRaw);
      end = Number(endRaw);
    } else {
      start = Number(rangePart);
      end = start;
    }

    if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) {
      throw badRequest(`Invalid cron range${options?.label ? ` for ${options.label}` : ''}: "${segment}"`);
    }

    for (let value = start; value <= end; value += step) {
      const normalized = options?.weekday ? normalizeWeekday(value) : value;
      if (normalized < min || normalized > max) {
        throw badRequest(`Invalid cron value${options?.label ? ` for ${options.label}` : ''}: "${segment}"`);
      }
      valueSet.add(normalized);
    }
  }

  if (wildcard) {
    for (let value = min; value <= max; value += 1) {
      valueSet.add(options?.weekday ? normalizeWeekday(value) : value);
    }
  }

  return { wildcard, values: valueSet };
}

function fieldMatches(field: CronField, value: number): boolean {
  return field.values.has(value);
}

function floorToMinute(date: Date): Date {
  const rounded = new Date(date.getTime());
  rounded.setUTCSeconds(0, 0);
  return rounded;
}

function dayMatches(expression: ParsedCron, date: Date): boolean {
  const dom = date.getUTCDate();
  const dow = date.getUTCDay();
  const domMatch = fieldMatches(expression.dayOfMonth, dom);
  const dowMatch = fieldMatches(expression.dayOfWeek, dow);

  if (expression.dayOfMonth.wildcard && expression.dayOfWeek.wildcard) return true;
  if (expression.dayOfMonth.wildcard) return dowMatch;
  if (expression.dayOfWeek.wildcard) return domMatch;
  return domMatch || dowMatch;
}

function matches(expression: ParsedCron, date: Date): boolean {
  return (
    fieldMatches(expression.minute, date.getUTCMinutes()) &&
    fieldMatches(expression.hour, date.getUTCHours()) &&
    fieldMatches(expression.month, date.getUTCMonth() + 1) &&
    dayMatches(expression, date)
  );
}

function nextAfter(expression: ParsedCron, date: Date): Date | null {
  const cursor = floorToMinute(date);
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);

  for (let i = 0; i < 525_600; i += 1) {
    if (matches(expression, cursor)) return new Date(cursor);
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }

  return null;
}

export class CronParser {
  parse(expression: string): ParsedCron {
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) throw badRequest(`Invalid cron expression: "${expression}"`);

    const [minuteRaw, hourRaw, domRaw, monthRaw, dowRaw] = parts;
    const parsed: ParsedCron = {
      expression,
      minute: buildField(minuteRaw!, 0, 59, { label: 'minute' }),
      hour: buildField(hourRaw!, 0, 23, { label: 'hour' }),
      dayOfMonth: buildField(domRaw!, 1, 31, { label: 'day-of-month' }),
      month: buildField(monthRaw!, 1, 12, { label: 'month' }),
      dayOfWeek: buildField(dowRaw!, 0, 6, { weekday: true, label: 'day-of-week' }),
      matches(date: Date): boolean {
        return matches(parsed, date);
      },
      nextAfter(date: Date): Date | null {
        return nextAfter(parsed, date);
      },
    };
    return parsed;
  }

  isDue(schedule: Schedule, currentTime: Date): boolean {
    if (!schedule.enabled) return false;
    const expression = this.parse(schedule.cron);
    const now = floorToMinute(currentTime);
    const nextRunAt = schedule.nextRunAt !== undefined ? new Date(schedule.nextRunAt) : null;
    if (nextRunAt !== null && now.getTime() < floorToMinute(nextRunAt).getTime()) return false;
    return expression.matches(now);
  }

  nextRunAt(cron: string, after: Date): Date | null {
    return this.parse(cron).nextAfter(after);
  }
}
