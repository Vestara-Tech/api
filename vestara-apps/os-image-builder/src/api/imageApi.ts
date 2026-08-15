import type {
  ImageBuildPlan,
  ImageBuildResult,
  ImageBuildState,
  ImageProfile,
  UpdateImageProfileInput,
} from './contracts';

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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');

  const response = await fetch(path, { ...init, headers });
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const err = body as { error?: { code?: string; message?: string; details?: unknown } } | null;
    throw new ApiError(
      response.status,
      err?.error?.code ?? 'http_error',
      err?.error?.message ?? response.statusText,
      err?.error?.details,
    );
  }
  return body as T;
}

export const imageApi = {
  listProfiles: () => request<readonly ImageProfile[]>('/api/v2/image/profiles'),

  getProfile: (id: string) => request<ImageProfile>(`/api/v2/image/profiles/${id}`),

  registerProfile: (profile: ImageProfile) =>
    request<ImageProfile>('/api/v2/image/profiles', { method: 'POST', body: JSON.stringify(profile) }),

  updateProfile: (id: string, patch: UpdateImageProfileInput) =>
    request<ImageProfile>(`/api/v2/image/profiles/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  plan: (profileId: string, target: string) =>
    request<ImageBuildPlan>('/api/v2/image/plan', { method: 'POST', body: JSON.stringify({ profileId, target }) }),

  build: (profileId: string, target: string, approved: boolean) =>
    request<ImageBuildResult>('/api/v2/image/build', {
      method: 'POST',
      body: JSON.stringify({ profileId, target, approved }),
    }),

  buildState: () => request<ImageBuildState>('/api/v2/image/build/state'),
};

export { imageApi as api };
