import type { ProjectionResult } from '../domain/dashboard.js';

export interface ProjectionProvider {
  readonly moduleId: string;
  readonly projectionId: string;
  fetch(): Promise<{ state: ProjectionResult['state']; data?: unknown; error?: string }>;
}

export interface ProjectionProviderOptions {
  readonly timeoutMs?: number;
  readonly cacheMs?: number;
}

interface CacheEntry {
  readonly result: ProjectionResult;
  readonly capturedAt: number;
}

/**
 * DASH-015/016/017 — Projection aggregation with provider timeout/isolation
 * and caching. One broken module must not break the dashboard: each provider
 * runs with its own timeout and failures degrade to a per-widget error state
 * instead of a dashboard HTTP 500.
 */
export class ProjectionService {
  private readonly providers = new Map<string, ProjectionProvider>();
  private readonly timeoutMs: number;
  private readonly cacheMs: number;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(options: ProjectionProviderOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 2500;
    this.cacheMs = options.cacheMs ?? 5000;
  }

  register(provider: ProjectionProvider): void {
    this.providers.set(provider.projectionId, provider);
  }

  unregister(projectionId: string): void {
    this.providers.delete(projectionId);
  }

  listProviders(): readonly string[] {
    return [...this.providers.keys()];
  }

  /** DASH-015 — aggregate projections concurrently, each isolated. */
  async aggregate(projectionIds: readonly string[]): Promise<readonly ProjectionResult[]> {
    return Promise.all(projectionIds.map((id) => this.fetch(id)));
  }

  async fetch(projectionId: string): Promise<ProjectionResult> {
    const cached = this.cache.get(projectionId);
    if (cached && Date.now() - cached.capturedAt < this.cacheMs) {
      const cachedAt = cached.result.cachedAt;
      return { ...cached.result, ...(cachedAt !== undefined ? { cachedAt } : {}), stale: false };
    }

    const provider = this.providers.get(projectionId);
    if (!provider) {
      const missing: ProjectionResult = { projectionId, moduleId: 'unknown', state: 'module-disabled', error: 'No provider registered' };
      this.cacheResult(projectionId, missing);
      return missing;
    }

    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const result = await Promise.race([
        provider.fetch(),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => reject(new Error(`Projection "${projectionId}" timed out after ${this.timeoutMs}ms`)));
        }),
      ]);
      const durationMs = Date.now() - startedAt;
      const projection: ProjectionResult = {
        projectionId,
        moduleId: provider.moduleId,
        state: result.state,
        ...(result.data !== undefined ? { data: result.data } : {}),
        ...(result.error !== undefined ? { error: result.error } : {}),
        durationMs,
        cachedAt: new Date().toISOString(),
      };
      this.cacheResult(projectionId, projection);
      return projection;
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const failed: ProjectionResult = {
        projectionId,
        moduleId: provider.moduleId,
        state: 'error',
        error: (err as Error).message,
        durationMs,
      };
      // Serve stale cache when available instead of failing the whole dashboard.
      if (cached) return { ...cached.result, stale: true, error: (err as Error).message };
      return failed;
    } finally {
      clearTimeout(timer);
    }
  }

  private cacheResult(projectionId: string, result: ProjectionResult): void {
    this.cache.set(projectionId, { result, capturedAt: Date.now() });
  }
}
