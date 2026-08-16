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

export interface ContributionManifestView {
  readonly provides: readonly { kind: string; id: string; name: string; version?: string }[];
  readonly requires: readonly { module: string; capability?: string }[];
  readonly optional: readonly { module: string; capability?: string }[];
}

export interface ContributionEntry {
  readonly packageId: string;
  readonly version: string;
  readonly manifest: ContributionManifestView;
}

export interface CapabilityIssue {
  readonly module: string;
  readonly capability?: string;
  readonly required: boolean;
  readonly satisfied: boolean;
}

export interface CapabilityResolution {
  readonly ok: boolean;
  readonly missingRequired: readonly string[];
  readonly issues: readonly CapabilityIssue[];
}

export interface BundleView {
  readonly bundleId: string;
  readonly name: string;
  readonly description?: string;
  readonly packages: readonly { packageId: string; versionRange?: string; required: boolean }[];
  readonly recommended: readonly { packageId: string; versionRange?: string }[];
  readonly optional: readonly { packageId: string; versionRange?: string }[];
  readonly ai?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface DistributionView {
  readonly distributionId: string;
  readonly name: string;
  readonly description?: string;
  readonly bundles: readonly { bundleId: string; required: boolean }[];
  readonly packages: readonly { packageId: string; required: boolean; channel?: string }[];
  readonly channel: string;
  readonly curatedBy: string;
  readonly ai?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface InstallPlan {
  readonly required: readonly string[];
  readonly recommended: readonly string[];
  readonly optional: readonly string[];
  readonly ai: readonly string[];
  readonly total: number;
}

export interface VersionEntry {
  readonly packageId: string;
  readonly version: string;
  readonly channel: string;
  readonly publishedAt: string;
  readonly changelog?: string;
}

export interface UpdateEvaluation {
  readonly packageId: string;
  readonly currentVersion: string;
  readonly latestVersion: string;
  readonly channel: string;
  readonly updateAvailable: boolean;
  readonly breaking: boolean;
  readonly policy: string;
  readonly action: string;
  readonly reason: string;
}

export interface UpdateImpact {
  readonly packageId: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly breaking: boolean;
  readonly reverseDependencies: readonly { dependent: string; versionRange: string; stillSatisfied: boolean }[];
  readonly capabilitiesAdded: readonly string[];
  readonly capabilitiesRemoved: readonly string[];
}

export interface PublisherView {
  readonly publisherId: string;
  readonly name: string;
  readonly trustLevel: string;
  readonly verified: boolean;
  readonly website?: string;
  readonly ownerUserId?: string;
}

export interface PublishedPackageView {
  readonly packageId: string;
  readonly version: string;
  readonly publisherId: string;
  readonly trustLevel: string;
  readonly channel: string;
  readonly signature: string;
  readonly publishedAt: string;
}

/** MKTUI — Marketplace v2 API client (relative paths; the Vite dev proxy forwards /api). */
export const marketplaceV2Api = {
  contributions: () => request<readonly ContributionEntry[]>('/api/v2/marketplace-v2/contributions'),

  provides: (kind: string) => request<readonly { packageId: string; id: string; name: string; version?: string }[]>(`/api/v2/marketplace-v2/provides/${kind}`),

  registerContribution: (packageId: string, version: string, manifest: ContributionManifestView) =>
    request<ContributionEntry>('/api/v2/marketplace-v2/contributions', { method: 'POST', body: JSON.stringify({ packageId, version, manifest }) }),

  resolve: (manifest: ContributionManifestView) =>
    request<CapabilityResolution>('/api/v2/marketplace-v2/resolve', { method: 'POST', body: JSON.stringify(manifest) }),

  bundles: () => request<readonly BundleView[]>('/api/v2/marketplace-v2/bundles'),

  createBundle: (input: Omit<BundleView, 'bundleId'>) =>
    request<BundleView>('/api/v2/marketplace-v2/bundles', { method: 'POST', body: JSON.stringify(input) }),

  distributions: () => request<readonly DistributionView[]>('/api/v2/marketplace-v2/distributions'),

  createDistribution: (input: Omit<DistributionView, 'distributionId'>) =>
    request<DistributionView>('/api/v2/marketplace-v2/distributions', { method: 'POST', body: JSON.stringify(input) }),

  planDistribution: (id: string) => request<InstallPlan>(`/api/v2/marketplace-v2/distributions/${id}/plan`),

  versions: (packageId: string) => request<readonly VersionEntry[]>(`/api/v2/marketplace-v2/versions/${packageId}`),

  publishVersion: (input: { packageId: string; version: string; channel: string; changelog?: string }) =>
    request<VersionEntry>('/api/v2/marketplace-v2/versions', { method: 'POST', body: JSON.stringify(input) }),

  promoteVersion: (input: { packageId: string; version: string; to: string }) =>
    request<VersionEntry>('/api/v2/marketplace-v2/versions/promote', { method: 'POST', body: JSON.stringify(input) }),

  setUpdatePolicy: (input: { packageId: string; policy: string; channel: string; blockMajor?: boolean }) =>
    request<{ packageId: string; policy: string; channel: string }>('/api/v2/marketplace-v2/updates/policy', { method: 'POST', body: JSON.stringify(input) }),

  evaluateUpdate: (input: { packageId: string; currentVersion: string; latestVersion: string; channel: string }) =>
    request<UpdateEvaluation>('/api/v2/marketplace-v2/updates/evaluate', { method: 'POST', body: JSON.stringify(input) }),

  impact: (input: { packageId: string; currentVersion: string; toVersion: string; channel: string }) =>
    request<UpdateImpact>('/api/v2/marketplace-v2/impact', { method: 'POST', body: JSON.stringify(input) }),

  publishers: () => request<readonly PublisherView[]>('/api/v2/marketplace-v2/publishers'),

  registerPublisher: (publisher: PublisherView) =>
    request<PublisherView>('/api/v2/marketplace-v2/publishers', { method: 'POST', body: JSON.stringify(publisher) }),

  publish: (input: { packageId: string; version: string; kind: string; publisherId: string; buildId: string; securityScanId: string; compatibilityHash: string; channel: string }) =>
    request<{ ok: boolean; reason?: string; published?: PublishedPackageView }>('/api/v2/marketplace-v2/publish', { method: 'POST', body: JSON.stringify(input) }),

  published: () => request<readonly PublishedPackageView[]>('/api/v2/marketplace-v2/published'),
};
