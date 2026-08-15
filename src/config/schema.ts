import { API_VERSION, DEFAULT_HOST, DEFAULT_LOG_LEVEL, DEFAULT_PORT, DEFAULT_REQUEST_TIMEOUT_MS, SERVICE_NAME } from './defaults.js';
import type { EnvironmentVariables } from './environment.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AppConfig {
  readonly nodeEnv: string;
  readonly service: typeof SERVICE_NAME;
  readonly apiVersion: typeof API_VERSION;
  readonly host: string;
  readonly port: number;
  readonly logLevel: LogLevel;
  readonly requestTimeoutMs: number;
}

export class ConfigError extends Error {
  readonly field: string;
  constructor(field: string, message: string) {
    super(`${field}: ${message}`);
    this.name = 'ConfigError';
    this.field = field;
  }
}

function parsePort(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  // Port 0 requests an ephemeral port from the OS (used by tests).
  if (value === 0) return 0;
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new ConfigError('VESTARA_API_PORT', `invalid port "${raw}" (expected 1-65535)`);
  }
  return value;
}

function parseLogLevel(raw: string | undefined): LogLevel {
  if (raw === undefined || raw === '') return DEFAULT_LOG_LEVEL;
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') return raw;
  throw new ConfigError('VESTARA_API_LOG_LEVEL', `invalid level "${raw}" (expected debug|info|warn|error)`);
}

function parseRequestTimeout(raw: string | undefined): number {
  if (raw === undefined || raw === '') return DEFAULT_REQUEST_TIMEOUT_MS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new ConfigError('VESTARA_API_REQUEST_TIMEOUT_MS', `invalid value "${raw}" (expected positive integer)`);
  }
  return value;
}

export function loadConfig(env: EnvironmentVariables): AppConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  return {
    nodeEnv,
    service: SERVICE_NAME,
    apiVersion: API_VERSION,
    host: env.VESTARA_API_HOST ?? DEFAULT_HOST,
    port: parsePort(env.VESTARA_API_PORT, DEFAULT_PORT),
    logLevel: parseLogLevel(env.VESTARA_API_LOG_LEVEL),
    requestTimeoutMs: parseRequestTimeout(env.VESTARA_API_REQUEST_TIMEOUT_MS),
  };
}
