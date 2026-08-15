export interface EnvironmentVariables {
  readonly NODE_ENV?: string | undefined;
  readonly VESTARA_API_HOST?: string | undefined;
  readonly VESTARA_API_PORT?: string | undefined;
  readonly VESTARA_API_LOG_LEVEL?: string | undefined;
  readonly VESTARA_API_REQUEST_TIMEOUT_MS?: string | undefined;
}

export function readEnvironment(source: NodeJS.ProcessEnv = process.env): EnvironmentVariables {
  return {
    NODE_ENV: source.NODE_ENV,
    VESTARA_API_HOST: source.VESTARA_API_HOST,
    VESTARA_API_PORT: source.VESTARA_API_PORT,
    VESTARA_API_LOG_LEVEL: source.VESTARA_API_LOG_LEVEL,
    VESTARA_API_REQUEST_TIMEOUT_MS: source.VESTARA_API_REQUEST_TIMEOUT_MS,
  };
}
