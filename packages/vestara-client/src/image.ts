import { ApiClient } from './client';

export interface ImageProfile {
  readonly id: string;
  readonly version: string;
  readonly architecture: string;
  readonly profileHash: string;
}

export interface ImageBuildPlan {
  readonly profileId: string;
  readonly profileHash: string;
  readonly target: string;
  readonly items: readonly { stage: string; description: string; generated: readonly string[] }[];
  readonly planHash: string;
}

export interface ImageBuildState {
  readonly buildId: string;
  readonly status: string;
  readonly completedStages: readonly string[];
}

/** imageApi built on the shared ApiClient (connectivity-aware). */
export function createImageApi(client: ApiClient) {
  return {
    listProfiles: () => client.request<readonly ImageProfile[]>('/api/v2/image/profiles'),
    getProfile: (id: string) => client.request<ImageProfile>(`/api/v2/image/profiles/${id}`),
    plan: (profileId: string, target: string) =>
      client.request<ImageBuildPlan>('/api/v2/image/plan', { method: 'POST', body: JSON.stringify({ profileId, target }) }),
    build: (profileId: string, target: string, approved: boolean) =>
      client.request<unknown>('/api/v2/image/build', { method: 'POST', body: JSON.stringify({ profileId, target, approved }) }),
    buildState: () => client.request<ImageBuildState>('/api/v2/image/build/state'),
  };
}

export type ImageApi = ReturnType<typeof createImageApi>;
