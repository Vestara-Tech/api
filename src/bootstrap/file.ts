import type { FileProviderPort } from '../file/providers/file-provider-port.js';
import { FileService } from '../file/service/file-service.js';

export interface FilePlatformOptions {
  readonly providers?: Readonly<Record<string, FileProviderPort>>;
}

export interface FilePlatform {
  readonly service: FileService;
}

/** FILE — Composition root. Defaults to an in-memory provider (no host writes). */
export function buildFilePlatform(options: FilePlatformOptions = {}): FilePlatform {
  const service = new FileService({ providers: options.providers ?? {} });
  return { service };
}
