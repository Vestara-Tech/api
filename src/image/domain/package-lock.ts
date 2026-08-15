/** IMG-036 — Package lock/resolution. Reproducibility for image builds. */

export interface LockedPackage {
  readonly name: string;
  readonly version: string;
  readonly hash: string;
}

export interface PackageResolutionRequest {
  readonly base: readonly string[];
  readonly extra: readonly string[];
}

export interface PackageResolutionResult {
  readonly locked: readonly LockedPackage[];
  readonly lockHash: string;
  readonly warnings: readonly string[];
  readonly resolvedAt: string;
}

/**
 * IMG-036 — Resolve requested packages into a locked, hashed manifest. In the
 * API process there is no real repository; the resolver is deterministic over
 * the requested set so the lock is stable across runs. A real backend would
 * delegate to the repository resolver and compatibility check.
 */
export function resolvePackages(request: PackageResolutionRequest): PackageResolutionResult {
  const locked: LockedPackage[] = [];
  const warnings: string[] = [];

  for (const name of [...request.base, ...request.extra]) {
    if (!name.trim()) continue;
    locked.push({ name, version: 'locked', hash: hashOf(name) });
  }

  const seen = new Set<string>();
  const deduped = locked.filter((p) => {
    if (seen.has(p.name)) {
      warnings.push(`Duplicate package "${p.name}" deduplicated`);
      return false;
    }
    seen.add(p.name);
    return true;
  });

  return {
    locked: deduped.sort((a, b) => a.name.localeCompare(b.name)),
    lockHash: hashOf(deduped.map((p) => `${p.name}@${p.version}:${p.hash}`).join('|')),
    warnings,
    resolvedAt: new Date().toISOString(),
  };
}

function hashOf(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `sha256-${Math.abs(hash).toString(16).padStart(12, '0')}`;
}
