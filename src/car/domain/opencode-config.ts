import { mergeEnvironment } from '../../config/environment.js';

/** DEX-CP0 — OpenCode runtime configuration. */

/**
 * Typed configuration for the OpenCode coding agent runtime adapter.
 *
 * Loaded from environment variables with validation. Precedence:
 *
 *   Task/agent override → CAR runtime policy → env vars → OpenCode native default
 */
export interface OpenCodeEnvironmentConfig {
  /** Whether Vestara manages the OpenCode server or connects to an external one. */
  readonly mode: 'managed' | 'external';

  /** Base URL of an external OpenCode server. Required when mode is 'external'. */
  readonly baseUrl?: string;

  /** Hostname for a managed OpenCode server. Ignored when mode is 'external'. */
  readonly hostname?: string;

  /** Port for a managed OpenCode server. Ignored when mode is 'external'. */
  readonly port?: number;

  /** Default AI provider ID to use when the agent does not specify one. */
  readonly defaultProvider?: string;

  /** Default AI model ID to use when the agent does not specify one. */
  readonly defaultModel?: string;

  /** Maximum time (ms) to wait for a managed OpenCode server to start. */
  readonly startupTimeoutMs: number;
}

export interface OpenCodeConfigLoadOptions {
  /** Environment variables to read from. Defaults to process.env. */
  readonly env?: Record<string, string | undefined>;

  /** Explicit overrides that take precedence over environment variables. */
  readonly overrides?: Partial<OpenCodeEnvironmentConfig>;
}

const DEFAULTS: OpenCodeEnvironmentConfig = {
  mode: 'external',
  startupTimeoutMs: 30_000,
};

/**
 * DEX-ENV-001 — Load OpenCode configuration from environment variables.
 *
 * Validation rules:
 *   - external mode requires baseUrl
 *   - managed mode: baseUrl is optional/ignored
 *   - startupTimeoutMs must be a positive integer
 *   - provider without model is permitted
 *   - model without provider is permitted (resolved via model identity)
 */
export function loadOpenCodeConfig(options?: OpenCodeConfigLoadOptions): OpenCodeEnvironmentConfig {
  const env =
    options?.env ??
    (typeof process !== 'undefined' ? mergeEnvironment() : { OPENCODE_MODE: 'external' });
  const raw: Record<string, string | undefined> = {
    OPENCODE_MODE: env.OPENCODE_MODE,
    OPENCODE_BASE_URL: env.OPENCODE_BASE_URL,
    OPENCODE_HOSTNAME: env.OPENCODE_HOSTNAME,
    OPENCODE_PORT: env.OPENCODE_PORT,
    OPENCODE_DEFAULT_PROVIDER: env.OPENCODE_DEFAULT_PROVIDER,
    OPENCODE_DEFAULT_MODEL: env.OPENCODE_DEFAULT_MODEL,
    OPENCODE_STARTUP_TIMEOUT_MS: env.OPENCODE_STARTUP_TIMEOUT_MS,
  };

  // Use a mutable builder to avoid readonly assignment errors.
  const parsed: {
    mode?: 'managed' | 'external';
    baseUrl?: string;
    hostname?: string;
    port?: number;
    defaultProvider?: string;
    defaultModel?: string;
    startupTimeoutMs?: number;
  } = {};

  if (raw.OPENCODE_MODE !== undefined && raw.OPENCODE_MODE !== '') {
    const mode = raw.OPENCODE_MODE;
    if (mode !== 'managed' && mode !== 'external') {
      throw new Error(`OPENCODE_MODE must be "managed" or "external", got "${mode}"`);
    }
    parsed.mode = mode;
  }

  if (raw.OPENCODE_BASE_URL !== undefined && raw.OPENCODE_BASE_URL !== '') {
    parsed.baseUrl = raw.OPENCODE_BASE_URL;
  }

  if (raw.OPENCODE_HOSTNAME !== undefined && raw.OPENCODE_HOSTNAME !== '') {
    parsed.hostname = raw.OPENCODE_HOSTNAME;
  }

  if (raw.OPENCODE_PORT !== undefined && raw.OPENCODE_PORT !== '') {
    const port = Number(raw.OPENCODE_PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`OPENCODE_PORT must be an integer between 1 and 65535, got "${raw.OPENCODE_PORT}"`);
    }
    parsed.port = port;
  }

  if (raw.OPENCODE_DEFAULT_PROVIDER !== undefined && raw.OPENCODE_DEFAULT_PROVIDER !== '') {
    parsed.defaultProvider = raw.OPENCODE_DEFAULT_PROVIDER;
  }

  if (raw.OPENCODE_DEFAULT_MODEL !== undefined && raw.OPENCODE_DEFAULT_MODEL !== '') {
    parsed.defaultModel = raw.OPENCODE_DEFAULT_MODEL;
  }

  if (raw.OPENCODE_STARTUP_TIMEOUT_MS !== undefined && raw.OPENCODE_STARTUP_TIMEOUT_MS !== '') {
    const ms = Number(raw.OPENCODE_STARTUP_TIMEOUT_MS);
    if (!Number.isInteger(ms) || ms <= 0) {
      throw new Error(`OPENCODE_STARTUP_TIMEOUT_MS must be a positive integer, got "${raw.OPENCODE_STARTUP_TIMEOUT_MS}"`);
    }
    parsed.startupTimeoutMs = ms;
  }

  // Apply explicit overrides last (highest precedence).
  const merged: OpenCodeEnvironmentConfig = {
    ...DEFAULTS,
    ...parsed,
    ...(options?.overrides ?? {}),
  };

  // Post-merge validation: only validate format, not runtime requirements.
  // The adapter validates connection requirements (e.g. baseUrl for external mode)
  // at connection time, not at config load time. This allows bootstrap to succeed
  // even when OpenCode is not configured — the adapter simply won't be selected.

  return merged;
}
