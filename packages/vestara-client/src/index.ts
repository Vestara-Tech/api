export { ApiClient, ApiError } from './client';
export type { ApiErrorCode, ApiConnectionState, ApiConnectionStatus, ApiHealthResult, ApiClientOptions, ApiErrorBody } from './client';
export { createImageApi } from './image';
export type { ImageApi, ImageProfile, ImageBuildPlan, ImageBuildState } from './image';

/** Default API base matching the backend DEFAULT_PORT (4310). */
export const DEFAULT_API_BASE = 'http://localhost:4310';

export function resolveApiBase(): string {
  if (typeof process !== 'undefined' && process.env?.VESTARA_API_URL) {
    return process.env.VESTARA_API_URL;
  }
  return DEFAULT_API_BASE;
}
