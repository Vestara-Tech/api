import type {
  ApiDefinition,
  Compatibility,
  Contract,
  CreateDefinitionInput,
  ListDefinitionsResult,
  PreviewResult,
  PublishResult,
  Revision,
  UpdateDefinitionInput,
  ValidationResult,
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

export interface ListQuery {
  readonly cursor?: string;
  readonly limit?: number;
  readonly status?: string;
  readonly search?: string;
  readonly sort?: string;
}

const qs = (query: ListQuery): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
};

export const builderApi = {
  list: (query: ListQuery = {}) => request<ListDefinitionsResult>(`/api/v2/builder/definitions${qs(query)}`),

  create: (input: CreateDefinitionInput) =>
    request<ApiDefinition>('/api/v2/builder/definitions', { method: 'POST', body: JSON.stringify(input) }),

  get: (id: string) => request<ApiDefinition>(`/api/v2/builder/definitions/${id}`),

  update: (id: string, patch: UpdateDefinitionInput, expectedRevision: number) =>
    request<ApiDefinition>(`/api/v2/builder/definitions/${id}`, {
      method: 'PATCH',
      headers: { 'If-Match': `"revision-${expectedRevision}"` },
      body: JSON.stringify(patch),
    }),

  remove: (id: string, expectedRevision: number) =>
    request<void>(`/api/v2/builder/definitions/${id}`, {
      method: 'DELETE',
      headers: { 'If-Match': `"revision-${expectedRevision}"` },
    }),

  validate: (id: string) =>
    request<ValidationResult>(`/api/v2/builder/definitions/${id}/validate`, { method: 'POST' }),

  preview: (id: string) =>
    request<PreviewResult>(`/api/v2/builder/definitions/${id}/preview`, { method: 'POST' }),

  publish: (id: string, expectedRevision: number) =>
    request<PublishResult>(`/api/v2/builder/definitions/${id}/publish`, {
      method: 'POST',
      headers: { 'If-Match': `"revision-${expectedRevision}"` },
    }),

  revisions: (id: string) => request<readonly Revision[]>(`/api/v2/builder/definitions/${id}/revisions`),

  revision: (id: string, revision: number) =>
    request<Revision>(`/api/v2/builder/definitions/${id}/revisions/${revision}`),

  rollback: (id: string) =>
    request<ApiDefinition>(`/api/v2/builder/definitions/${id}/rollback`, { method: 'POST' }),
};

export type { ApiDefinition, Compatibility, Contract, PreviewResult, Revision, ValidationResult };
