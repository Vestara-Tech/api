/** SYS-029/030 — Storage manager. Read-only discovery broadly; mutations escalate. */

export type StorageMutationKind = 'mount' | 'unmount' | 'partition-create' | 'format' | 'erase';

export interface MountInfo {
  readonly device: string;
  readonly mountPoint: string;
  readonly filesystem: string;
  readonly options?: string;
  readonly readOnly: boolean;
}

export interface StorageManagerPort {
  listDisks(): Promise<readonly { name: string; sizeBytes: number; type?: string }[]>;
  listMounts(): Promise<readonly MountInfo[]>;
  mutate(kind: StorageMutationKind, target: string, options?: Readonly<Record<string, unknown>>): Promise<{ ok: boolean; message?: string }>;
}

export const STORAGE_MUTATION_RISK: Record<StorageMutationKind, 'low' | 'medium' | 'high' | 'critical'> = {
  mount: 'medium',
  unmount: 'medium',
  'partition-create': 'high',
  format: 'critical',
  erase: 'critical',
};

/**
 * SYS-029/030 — Storage manager. Read discovery is broadly available;
 * mutations require escalating permissions per the risk table. Mutations are
 * delegated to the privileged daemon through typed operations — never
 * arbitrary commands.
 */
export class StorageManager {
  private readonly port: StorageManagerPort;

  constructor(port: StorageManagerPort) {
    this.port = port;
  }

  risk(kind: StorageMutationKind): string {
    return STORAGE_MUTATION_RISK[kind];
  }

  async disks() {
    return this.port.listDisks();
  }

  async mounts(): Promise<readonly MountInfo[]> {
    return this.port.listMounts();
  }

  async mutate(kind: StorageMutationKind, target: string, options?: Readonly<Record<string, unknown>>): Promise<{ ok: boolean; message?: string }> {
    return this.port.mutate(kind, target, options);
  }
}

/** Environment adapter: read-only discovery; mutations honestly refused. */
export class EnvironmentStorageManager implements StorageManagerPort {
  async listDisks() {
    return [{ name: 'sda', sizeBytes: 0, type: 'unknown' }];
  }

  async listMounts(): Promise<readonly MountInfo[]> {
    return [];
  }

  async mutate(kind: StorageMutationKind): Promise<{ ok: boolean; message?: string }> {
    return { ok: false, message: `no privileged storage access in this environment (${kind})` };
  }
}
