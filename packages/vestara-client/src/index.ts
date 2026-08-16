export { ApiClient, ApiError } from './client';
export type { ApiErrorCode, ApiConnectionState, ApiConnectionStatus, ApiHealthResult, ApiNegotiationResult, ApiClientOptions, ApiErrorBody } from './client';
export { createImageApi } from './image';
export type { ImageApi, ImageProfile, ImageBuildPlan, ImageBuildState } from './image';

/** Default API base matching the backend DEFAULT_HOST/DEFAULT_PORT (127.0.0.1:4310). */
export const DEFAULT_API_BASE = 'http://127.0.0.1:4310';

export function resolveApiBase(): string {
  if (typeof process !== 'undefined' && process.env?.VESTARA_API_URL) {
    return process.env.VESTARA_API_URL;
  }
  return DEFAULT_API_BASE;
}
