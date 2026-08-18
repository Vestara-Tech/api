import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface EnvironmentVariables {
  readonly NODE_ENV?: string | undefined;
  readonly VESTARA_API_HOST?: string | undefined;
  readonly VESTARA_API_PORT?: string | undefined;
  readonly VESTARA_API_LOG_LEVEL?: string | undefined;
  readonly VESTARA_API_REQUEST_TIMEOUT_MS?: string | undefined;
}

function parseDotenvLine(line: string): readonly [string, string] | undefined {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith('#')) return undefined;

  const content = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
  const separator = content.indexOf('=');
  if (separator <= 0) return undefined;

  const key = content.slice(0, separator).trim();
  if (key.length === 0) return undefined;

  let value = content.slice(separator + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

export function readDotenv(sourcePath = resolve(process.cwd(), '.env')): Readonly<Record<string, string>> {
  if (!existsSync(sourcePath)) return {};

  const parsed: Record<string, string> = {};
  const contents = readFileSync(sourcePath, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const entry = parseDotenvLine(line);
    if (!entry) continue;
    const [key, value] = entry;
    parsed[key] = value;
  }

  return parsed;
}

export function mergeEnvironment(source: NodeJS.ProcessEnv = process.env, dotenvPath = resolve(process.cwd(), '.env')): NodeJS.ProcessEnv {
  return {
    ...readDotenv(dotenvPath),
    ...source,
  };
}

export function readEnvironment(source: NodeJS.ProcessEnv = mergeEnvironment()): EnvironmentVariables {
  return {
    NODE_ENV: source.NODE_ENV,
    VESTARA_API_HOST: source.VESTARA_API_HOST,
    VESTARA_API_PORT: source.VESTARA_API_PORT,
    VESTARA_API_LOG_LEVEL: source.VESTARA_API_LOG_LEVEL,
    VESTARA_API_REQUEST_TIMEOUT_MS: source.VESTARA_API_REQUEST_TIMEOUT_MS,
  };
}
