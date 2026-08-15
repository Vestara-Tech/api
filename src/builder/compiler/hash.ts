import { createHash } from 'node:crypto';

/**
 * Deterministic contract hash. `same definition + same compiler version →
 * same hash`, independent of object key ordering or unrelated fields.
 */
export function hashContract(payload: unknown, compilerVersion: string): string {
  const canonical = stableStringify(payload);
  return createHash('sha256').update(`${compilerVersion}\n${canonical}`).digest('hex');
}

export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(',')}}`;
}
