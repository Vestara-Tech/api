import type { FileResource, FileResourceKind } from '../domain/contracts.js';

export interface ProviderReadResult {
  readonly content: string;
  readonly resource: FileResource;
}

export interface ProviderWriteInput {
  readonly path: string;
  readonly content: string;
}

/**
 * FILE — Provider port. FileService depends on this abstraction, never on a
 * concrete filesystem. Local disk is one provider; memory, artifacts, remote
 * workspaces and cloud storage are others.
 */
export interface FileProviderPort {
  readonly providerId: string;

  read(path: string): Promise<ProviderReadResult>;
  list(directoryPath: string): Promise<readonly FileResource[]>;
  stat(path: string): Promise<FileResource>;
  search(query: string, rootPath: string, limit?: number): Promise<readonly FileResource[]>;

  create(input: ProviderWriteInput): Promise<FileResource>;
  write(input: ProviderWriteInput): Promise<FileResource>;
  remove(path: string): Promise<boolean>;
  mkdir(path: string): Promise<FileResource>;
  copy(source: string, destination: string): Promise<FileResource>;
  move(source: string, destination: string): Promise<FileResource>;

  /** Optional: transactional snapshot for rollback support. */
  snapshot?(paths: readonly string[]): Promise<Readonly<Record<string, string>>>;
  restore?(snapshot: Readonly<Record<string, string>>): Promise<void>;
}

export function providerFileResource(
  providerId: string,
  path: string,
  kind: FileResourceKind,
  overrides: Partial<FileResource> = {},
): FileResource {
  const name = path.split('/').filter(Boolean).pop() ?? path;
  return {
    id: `${providerId}:${path}`,
    name,
    path,
    kind,
    providerId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    capabilities: ['file.read', 'file.list', 'file.stat'],
    ...overrides,
  };
}
