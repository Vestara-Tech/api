import { ApiClient } from '@vestara/client';
import type {
  ImageBuildPlan,
  ImageBuildResult,
  ImageBuildState,
  ImageProfile,
  UpdateImageProfileInput,
} from '../api/contracts';
import { imageClient } from './client';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function clientOrNew(): ApiClient {
  return imageClient ?? new ApiClient({ apiBase: 'http://localhost:4310' });
}

/**
 * imageApi — thin wrapper over the shared connectivity-aware ApiClient. All
 * network failures surface as typed ApiError codes (offline / not_found /
 * server_error / invalid_response), so the UI can distinguish an unreachable
 * API from a missing endpoint or a 500.
 */
export const imageApi = {
  listProfiles: () => clientOrNew().request<readonly ImageProfile[]>('/api/v2/image/profiles'),

  getProfile: (id: string) => clientOrNew().request<ImageProfile>(`/api/v2/image/profiles/${id}`),

  registerProfile: (profile: ImageProfile) =>
    clientOrNew().request<ImageProfile>('/api/v2/image/profiles', { method: 'POST', body: JSON.stringify(profile) }),

  updateProfile: (id: string, patch: UpdateImageProfileInput) =>
    clientOrNew().request<ImageProfile>(`/api/v2/image/profiles/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  plan: (profileId: string, target: string) =>
    clientOrNew().request<ImageBuildPlan>('/api/v2/image/plan', { method: 'POST', body: JSON.stringify({ profileId, target }) }),

  build: (profileId: string, target: string, approved: boolean) =>
    clientOrNew().request<ImageBuildResult>('/api/v2/image/build', {
      method: 'POST',
      body: JSON.stringify({ profileId, target, approved }),
    }),

  buildState: () => clientOrNew().request<ImageBuildState>('/api/v2/image/build/state'),
};
