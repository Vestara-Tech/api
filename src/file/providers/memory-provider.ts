import { notFound } from '../../core/errors.js';
import { createHash } from 'node:crypto';
import type { FileResource } from '../domain/contracts.js';
import { providerFileResource, type FileProviderPort, type ProviderReadResult, type ProviderWriteInput } from './file-provider-port.js';

interface MemoryEntry {
  readonly content: string;
  readonly createdAt: string;
}

/**
 * FILE — In-memory provider. Used by tests, previews, and ephemeral
 * workspaces. No host filesystem access.
 */
export class MemoryProvider implements FileProviderPort {
  readonly providerId: string;
  private readonly entries = new Map<string, MemoryEntry>();
  private readonly dirs = new Set<string>();

  constructor(providerId = 'memory') {
    this.providerId = providerId;
  }

  seed(path: string, content: string): void {
    this.entries.set(path, { content, createdAt: new Date().toISOString() });
    this.ensureParents(path);
  }

  private ensureParents(path: string): void {
    let current = path;
    for (;;) {
      const idx = current.lastIndexOf('/');
      if (idx <= 0) break;
      current = current.slice(0, idx);
      this.dirs.add(current);
    }
  }

  private getEntry(path: string): { entry: MemoryEntry; resource: FileResource } {
    const entry = this.entries.get(path);
    if (!entry) throw notFound(`File "${path}" not found in memory provider`);
    const hash = hashOf(entry.content);
    return {
      entry,
      resource: {
        ...providerFileResource(this.providerId, path, 'file'),
        size: entry.content.length,
        hash,
        updatedAt: entry.createdAt,
        ...(mimeOf(path) !== undefined ? { mimeType: mimeOf(path)! } : {}),
      },
    };
  }

  async read(path: string): Promise<ProviderReadResult> {
    const { entry, resource } = this.getEntry(path);
    return { content: entry.content, resource };
  }

  async list(directoryPath: string): Promise<readonly FileResource[]> {
    const prefix = directoryPath === '/' ? '/' : `${directoryPath}/`;
    const resources: FileResource[] = [];
    const seen = new Set<string>();
    for (const path of this.entries.keys()) {
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length);
      const segment = rest.split('/')[0]!;
      const full = segment === '' ? path : `${directoryPath === '/' ? '' : directoryPath}/${segment}`;
      if (seen.has(full)) continue;
      seen.add(full);
      if (this.entries.has(full)) {
        resources.push(this.getEntry(full).resource);
      } else if (this.dirs.has(full)) {
        resources.push(providerFileResource(this.providerId, full, 'directory'));
      }
    }
    return resources;
  }

  async stat(path: string): Promise<FileResource> {
    if (this.entries.has(path)) return this.getEntry(path).resource;
    if (this.dirs.has(path)) return providerFileResource(this.providerId, path, 'directory');
    throw notFound(`Path "${path}" not found in memory provider`);
  }

  async search(query: string, rootPath: string, limit = 50): Promise<readonly FileResource[]> {
    const results: FileResource[] = [];
    for (const path of this.entries.keys()) {
      if (!path.startsWith(rootPath)) continue;
      if (path.toLowerCase().includes(query.toLowerCase())) {
        results.push(this.getEntry(path).resource);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  async create(input: ProviderWriteInput): Promise<FileResource> {
    this.entries.set(input.path, { content: input.content, createdAt: new Date().toISOString() });
    this.ensureParents(input.path);
    return this.getEntry(input.path).resource;
  }

  async write(input: ProviderWriteInput): Promise<FileResource> {
    if (!this.entries.has(input.path)) throw notFound(`File "${input.path}" not found`);
    this.entries.set(input.path, { content: input.content, createdAt: new Date().toISOString() });
    return this.getEntry(input.path).resource;
  }

  async remove(path: string): Promise<boolean> {
    if (this.entries.has(path)) {
      this.entries.delete(path);
      return true;
    }
    if (this.dirs.has(path)) {
      const prefix = `${path}/`;
      for (const p of [...this.entries.keys()]) {
        if (p.startsWith(prefix)) this.entries.delete(p);
      }
      this.dirs.delete(path);
      return true;
    }
    return false;
  }

  async mkdir(path: string): Promise<FileResource> {
    this.ensureParents(`${path}/.keep`);
    this.dirs.add(path);
    return providerFileResource(this.providerId, path, 'directory');
  }

  async copy(source: string, destination: string): Promise<FileResource> {
    const { entry } = this.getEntry(source);
    this.entries.set(destination, { content: entry.content, createdAt: new Date().toISOString() });
    this.ensureParents(destination);
    return this.getEntry(destination).resource;
  }

  async move(source: string, destination: string): Promise<FileResource> {
    const { entry } = this.getEntry(source);
    this.entries.delete(source);
    this.entries.set(destination, { content: entry.content, createdAt: new Date().toISOString() });
    this.ensureParents(destination);
    return this.getEntry(destination).resource;
  }

  async snapshot(paths: readonly string[]): Promise<Readonly<Record<string, string>>> {
    const out: Record<string, string> = {};
    for (const path of paths) {
      if (this.entries.has(path)) out[path] = this.entries.get(path)!.content;
    }
    return out;
  }

  async restore(snapshot: Readonly<Record<string, string>>): Promise<void> {
    for (const [path, content] of Object.entries(snapshot)) {
      this.entries.set(path, { content, createdAt: new Date().toISOString() });
    }
  }
}

export function hashOf(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function mimeOf(path: string): string | undefined {
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'text/typescript';
  if (path.endsWith('.json')) return 'application/json';
  if (path.endsWith('.md')) return 'text/markdown';
  if (path.endsWith('.html')) return 'text/html';
  return undefined;
}
