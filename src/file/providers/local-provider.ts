import { readFile, writeFile, readdir, stat, mkdir, rm, copyFile, rename } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { forbidden, notFound } from '../../core/errors.js';
import type { FileResource } from '../domain/contracts.js';
import { providerFileResource, type FileProviderPort, type ProviderReadResult, type ProviderWriteInput } from './file-provider-port.js';

/**
 * FILE — Local (OS) provider. Wraps a single host directory as the provider
 * root. Writes are disabled unless `writable: true` (agent tools default to
 * read-only; mutations flow through governed transactions).
 */
export class LocalProvider implements FileProviderPort {
  readonly providerId: string;
  private readonly root: string;
  private readonly writable: boolean;

  constructor(root: string, options: { providerId?: string; writable?: boolean } = {}) {
    this.root = root;
    this.providerId = options.providerId ?? 'local';
    this.writable = options.writable ?? false;
  }

  private abs(path: string): string {
    // Paths are namespaced: local://<rel> or a bare relative path.
    const rel = path.replace(/^local:\/\//, '').replace(/^\/+/, '');
    return join(this.root, rel);
  }

  private assertWritable(op: string): void {
    if (!this.writable) throw forbidden(`Local provider is read-only: cannot ${op}`);
  }

  async read(path: string): Promise<ProviderReadResult> {
    const abs = this.abs(path);
    try {
      const content = await readFile(abs, 'utf8');
      const info = await stat(abs);
      return {
        content,
        resource: this.toResource(path, 'file', info.size, hashOf(content), info.mtime.toISOString()),
      };
    } catch (err) {
      throw notFound(`File "${path}" not found (${(err as Error).message})`);
    }
  }

  async list(directoryPath: string): Promise<readonly FileResource[]> {
    const abs = this.abs(directoryPath);
    try {
      const names = await readdir(abs);
      const resources: FileResource[] = [];
      for (const name of names) {
        const child = join(abs, name);
        const info = await stat(child);
        const rel = pathOf(this.root, child);
        if (info.isDirectory()) {
          resources.push(providerFileResource(this.providerId, rel, 'directory'));
        } else if (info.isFile()) {
          resources.push(providerFileResource(this.providerId, rel, 'file', { size: info.size, updatedAt: info.mtime.toISOString() }));
        }
      }
      return resources;
    } catch (err) {
      throw notFound(`Directory "${directoryPath}" not found (${(err as Error).message})`);
    }
  }

  async stat(path: string): Promise<FileResource> {
    const abs = this.abs(path);
    const info = await stat(abs);
    if (info.isDirectory()) return providerFileResource(this.providerId, path, 'directory', { updatedAt: info.mtime.toISOString() });
    return this.toResource(path, 'file', info.size, undefined, info.mtime.toISOString());
  }

  async search(query: string, rootPath: string, limit = 50): Promise<readonly FileResource[]> {
    const results: FileResource[] = [];
    const walk = async (dir: string): Promise<void> => {
      if (results.length >= limit) return;
      let names: string[] = [];
      try {
        names = await readdir(dir);
      } catch {
        return;
      }
      for (const name of names) {
        if (results.length >= limit) return;
        const child = join(dir, name);
        try {
          const info = await stat(child);
          const rel = pathOf(this.root, child);
          if (info.isFile() && name.toLowerCase().includes(query.toLowerCase())) {
            results.push(providerFileResource(this.providerId, rel, 'file', { size: info.size }));
          } else if (info.isDirectory()) {
            await walk(child);
          }
        } catch {
          // skip unreadable entries
        }
      }
    };
    await walk(this.abs(rootPath));
    return results;
  }

  async create(input: ProviderWriteInput): Promise<FileResource> {
    this.assertWritable('create');
    const abs = this.abs(input.path);
    await writeFile(abs, input.content, 'utf8');
    return this.toResource(input.path, 'file', input.content.length, hashOf(input.content));
  }

  async write(input: ProviderWriteInput): Promise<FileResource> {
    this.assertWritable('write');
    const abs = this.abs(input.path);
    await writeFile(abs, input.content, 'utf8');
    return this.toResource(input.path, 'file', input.content.length, hashOf(input.content));
  }

  async remove(path: string): Promise<boolean> {
    this.assertWritable('delete');
    await rm(this.abs(path), { recursive: true, force: true });
    return true;
  }

  async mkdir(path: string): Promise<FileResource> {
    this.assertWritable('mkdir');
    await mkdir(this.abs(path), { recursive: true });
    return providerFileResource(this.providerId, path, 'directory');
  }

  async copy(source: string, destination: string): Promise<FileResource> {
    this.assertWritable('copy');
    await copyFile(this.abs(source), this.abs(destination));
    return providerFileResource(this.providerId, destination, 'file');
  }

  async move(source: string, destination: string): Promise<FileResource> {
    this.assertWritable('move');
    await rename(this.abs(source), this.abs(destination));
    return providerFileResource(this.providerId, destination, 'file');
  }

  private toResource(path: string, kind: 'file', size: number, hash: string | undefined, updatedAt?: string): FileResource {
    return {
      ...providerFileResource(this.providerId, path, kind),
      name: basename(path),
      size,
      ...(hash !== undefined ? { hash } : {}),
      ...(updatedAt !== undefined ? { updatedAt } : {}),
    };
  }
}

function hashOf(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function pathOf(root: string, abs: string): string {
  return abs.startsWith(root) ? abs.slice(root.length).replace(/^\/+/, '') : abs;
}
