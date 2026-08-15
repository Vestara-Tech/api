import type { LogRecord } from '../contracts.js';

const SENSITIVE_KEYS = new Set([
  'authorization', 'api_key', 'apikey', 'x-api-key', 'password', 'token', 'access_token',
  'refresh_token', 'session_token', 'secret', 'credentials', 'client_secret', 'cookie',
]);

const REDACTION_PATTERNS: readonly { pattern: RegExp; replacement: string }[] = [
  { pattern: /(authorization:\s*)(Bearer\s+[A-Za-z0-9._-]+)/i, replacement: '$1[REDACTED]' },
  { pattern: /(api[_-]?key["']?\s*[:=]\s*["']?)[A-Za-z0-9._-]+/i, replacement: '$1[REDACTED]' },
  { pattern: /(password["']?\s*[:=]\s*["']?)[^"',\s]+/i, replacement: '$1[REDACTED]' },
  { pattern: /(secret:\/\/[^\s"',]+)/gi, replacement: '[REDACTED-SECRET-REF]' },
  { pattern: /(session[_-]?token["']?\s*[:=]\s*["']?)[A-Za-z0-9._-]+/i, replacement: '$1[REDACTED]' },
];

/**
 * LOG-006 — Secret redaction pipeline. A foundational invariant: raw events
 * are redacted before storage. Authorization headers, API keys, OAuth tokens,
 * passwords, session tokens and secret:// references are masked.
 */
export class LogRedactor {
  redact(value: unknown): unknown {
    if (typeof value === 'string') return this.redactString(value);
    if (Array.isArray(value)) return value.map((v) => this.redact(v));
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) && val !== undefined ? '[REDACTED]' : this.redact(val);
      }
      return out;
    }
    return value;
  }

  redactRecord(record: LogRecord): LogRecord {
    return { ...record, attributes: this.redact(record.attributes) as Readonly<Record<string, unknown>> };
  }

  private redactString(input: string): string {
    let out = input;
    for (const { pattern, replacement } of REDACTION_PATTERNS) {
      out = out.replace(pattern, replacement);
    }
    return out;
  }
}
