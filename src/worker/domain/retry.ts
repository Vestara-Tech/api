import type { RetryPolicy } from '../contracts.js';

/** WKR-004 — Retry delay computation. */
export class RetryCalculator {
  nextDelay(
    policy: RetryPolicy,
    attempt: number,
    baseDelayMs: number,
    maxDelayMs = Number.POSITIVE_INFINITY,
  ): number | null {
    if (policy === 'none') return null;

    const normalizedAttempt = Math.max(1, Math.trunc(attempt));
    const rawDelay = policy === 'fixed'
      ? baseDelayMs
      : baseDelayMs * (2 ** (normalizedAttempt - 1));

    return Math.max(0, Math.min(rawDelay, maxDelayMs));
  }

  nextRetryAt(
    now: Date | string | number,
    policy: RetryPolicy,
    attempt: number,
    baseDelayMs: number,
    maxDelayMs = Number.POSITIVE_INFINITY,
  ): string | null {
    const delay = this.nextDelay(policy, attempt, baseDelayMs, maxDelayMs);
    if (delay === null) return null;

    const startedAt = typeof now === 'number' ? now : typeof now === 'string' ? Date.parse(now) : now.getTime();
    return new Date(startedAt + delay).toISOString();
  }
}
