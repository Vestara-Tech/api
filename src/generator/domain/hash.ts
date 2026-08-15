import { createHash } from 'node:crypto';

/** Deterministic canonical JSON for hashing (order-independent). */
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(',')}}`;
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Deterministic hash of any JSON-serializable value. */
export function hashOf(value: unknown): string {
  return sha256(stableStringify(value));
}

/** Combined hash with labeled parts for provenance (generator/input/config/...). */
export function hashParts(parts: Readonly<Record<string, unknown>>): string {
  return sha256(stableStringify(parts));
}
