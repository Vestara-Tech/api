async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...init, headers });
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const err = body as { error?: { code?: string; message?: string } } | null;
    const e = new Error(err?.error?.message ?? `HTTP ${response.status}`) as Error & { code?: string; status?: number };
    e.code = err?.error?.code ?? 'http_error';
    e.status = response.status;
    throw e;
  }
  return body as T;
}

export interface PackageView {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly kind: string;
  readonly publisher: string;
  readonly description?: string;
  readonly installs?: number;
  readonly rating?: number;
}

export interface PackageDetail {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly kind: string;
  readonly publisher: { id: string; name: string; verified: boolean };
  readonly description?: string;
  readonly dependencies: readonly { packageId: string; versionRange: string; required: boolean }[];
  readonly permissions: readonly { id: string; required: boolean; approval?: string }[];
  readonly capabilities: readonly { id: string; name: string }[];
  readonly compatibility: { apiRange?: string; platformRange?: string };
  readonly provenance: { source: string; verified: boolean; publishedAt: string };
  readonly installs?: number;
  readonly rating?: number;
}

export interface InstalledView {
  readonly packageId: string;
  readonly version: string;
  readonly status: string;
  readonly enabled: boolean;
  readonly installedAt: string;
  readonly knownGoodVersion?: string;
}

export const marketplaceApi = {
  packages: (search?: string, kind?: string) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (kind) params.set('kind', kind);
    const qs = params.toString();
    return request<readonly PackageView[]>(`/api/v2/marketplace/packages${qs ? `?${qs}` : ''}`);
  },

  package: (id: string) => request<PackageDetail>(`/api/v2/marketplace/packages/${id}`),

  categories: () => request<readonly { name: string; count: number }[]>('/api/v2/marketplace/categories'),

  installed: () => request<readonly InstalledView[]>('/api/v2/marketplace/installed'),

  install: (packageId: string, approved?: boolean) =>
    request<{ packageId: string; version: string; status: string; operationId: string }>('/api/v2/marketplace/install', {
      method: 'POST',
      body: JSON.stringify({ packageId, ...(approved !== undefined ? { approved } : {}) }),
    }),

  enable: (id: string) => request<PackageView>(`/api/v2/marketplace/packages/${id}/enable`, { method: 'POST' }),
  disable: (id: string) => request<PackageView>(`/api/v2/marketplace/packages/${id}/disable`, { method: 'POST' }),
  update: (id: string) => request<{ from: string; to: string; status: string }>(`/api/v2/marketplace/packages/${id}/update`, { method: 'POST' }),
  uninstall: (id: string) => request<void>(`/api/v2/marketplace/packages/${id}`, { method: 'DELETE' }),
};
