export interface ApplyResult {
  readonly ok: boolean;
  readonly message?: string;
}

import type { VestaraImageProfile } from '../domain/profile.js';

/** IMG-005 — Image workspace / rootfs abstraction. Writes land under the image root, never the host. */export interface ImageRootfsPort {
  write(relPath: string, content: string): Promise<void>;
  exists(relPath: string): Promise<boolean>;
  read(relPath: string): Promise<string | null>;
  rootPath(): string;
}

export interface BootstrapResult {
  readonly ok: boolean;
  readonly rootfs: string;
  readonly message?: string;
}

/** IMG-006 — Debian bootstrap adapter (debootstrap into the image rootfs). */
export interface BootstrapAdapter {
  bootstrap(profile: VestaraImageProfile, rootfs: string): Promise<BootstrapResult>;
}

export interface PackageInstaller {
  install(packages: readonly string[], rootfs: string): Promise<ApplyResult>;
}

/** IMG-007 — Package installation into the image rootfs. */
export interface ImagePackagePort {
  install(packages: readonly string[]): Promise<ApplyResult>;
}
