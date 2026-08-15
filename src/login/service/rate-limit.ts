export interface RateLimitWindow {
  readonly maxAttempts: number;
  readonly windowMs: number;
  readonly lockoutMs: number;
}

export interface FailedAttempt {
  readonly userId: string;
  readonly count: number;
  readonly firstFailedAt: number;
  readonly lockedUntil?: number;
}

/**
 * LOGIN-009 — Failed-attempt / rate-limit policy. Applies per user within a
 * rolling window; exceeding the threshold locks the account until `lockoutMs`
 * elapses.
 */
export class LoginRateLimit {
  private readonly attempts = new Map<string, FailedAttempt>();

  constructor(private readonly policy: RateLimitWindow = { maxAttempts: 5, windowMs: 60_000, lockoutMs: 300_000 }) {}

  recordFailure(userId: string): boolean {
    const now = Date.now();
    const existing = this.attempts.get(userId);
    const firstFailedAt = existing && now - existing.firstFailedAt < this.policy.windowMs ? existing.firstFailedAt : now;
    const count = existing && now - existing.firstFailedAt < this.policy.windowMs ? existing.count + 1 : 1;
    const locked = count >= this.policy.maxAttempts;
    this.attempts.set(userId, { userId, count, firstFailedAt, ...(locked ? { lockedUntil: now + this.policy.lockoutMs } : {}) });
    return locked;
  }

  isBlocked(userId: string): boolean {
    const attempt = this.attempts.get(userId);
    if (!attempt) return false;
    if (attempt.lockedUntil !== undefined) {
      if (Date.now() < attempt.lockedUntil) return true;
      // Lockout expired — reset.
      this.attempts.delete(userId);
      return false;
    }
    return false;
  }

  recordSuccess(userId: string): void {
    this.attempts.delete(userId);
  }
}
