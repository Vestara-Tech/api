import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import type { AiModel, AiProvider } from '../domain/contracts.js';

export interface CatalogSnapshot {
  readonly version: string;
  readonly generatedAt: string;
  readonly source: string;
  readonly providers: readonly AiProvider[];
  readonly models: readonly AiModel[];
  readonly checksum: string;
}

/**
 * AI-006 — Catalog cache. A validated snapshot is persisted locally so Vestara
 * remains usable when models.dev is unreachable. AI execution never depends on
 * a network catalog call.
 */
export class CatalogCache {
  private readonly cachePath: string;

  constructor(cachePath: string) {
    this.cachePath = cachePath;
  }

  async load(): Promise<CatalogSnapshot | null> {
    try {
      const raw = await readFile(this.cachePath, 'utf8');
      const snapshot = JSON.parse(raw) as CatalogSnapshot;
      if (!this.validate(snapshot)) return null;
      return snapshot;
    } catch {
      return null;
    }
  }

  async save(snapshot: CatalogSnapshot): Promise<void> {
    await mkdir(resolve(this.cachePath, '..'), { recursive: true });
    await writeFile(this.cachePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  }

  validate(snapshot: CatalogSnapshot): boolean {
    if (typeof snapshot !== 'object' || snapshot === null) return false;
    if (typeof snapshot.version !== 'string' || snapshot.version.length === 0) return false;
    if (!Array.isArray(snapshot.providers) || !Array.isArray(snapshot.models)) return false;
    if (typeof snapshot.checksum !== 'string' || snapshot.checksum.length === 0) return false;
    const computed = checksum(snapshot.providers, snapshot.models);
    return computed === snapshot.checksum;
  }
}

export function buildSnapshot(providers: readonly AiProvider[], models: readonly AiModel[], source: string): CatalogSnapshot {
  const now = new Date().toISOString();
  return {
    version: '1',
    generatedAt: now,
    source,
    providers,
    models,
    checksum: checksum(providers, models),
  };
}

export function checksum(providers: readonly AiProvider[], models: readonly AiModel[]): string {
  const hash = createHash('sha256');
  hash.update(JSON.stringify({ providers, models }));
  return hash.digest('hex');
}
