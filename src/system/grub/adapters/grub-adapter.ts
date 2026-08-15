import type { GrubConfiguration } from '../domain/configuration.js';
import type { BootEntry } from '../../domain/boot.js';
import type { BootAssetRef } from '../../boot-presentation/domain/asset.js';

export interface GrubApplyResult {
  readonly ok: boolean;
  readonly message?: string;
}

/**
 * SYS-019 — GRUB adapter port.
 *
 * The privileged `vestara-system` service performs all GRUB operations. The API
 * never edits `/etc/default/grub` or `grub.cfg` text directly; Vestara manages
 * configuration inputs/drop-ins and invokes the distribution's supported
 * generation mechanism (`update-grub` / `grub-mkconfig`).
 */
export interface GrubAdapter {
  discover(): Promise<{ readonly available: boolean; readonly version?: string; readonly reason?: string }>;
  read(): Promise<GrubConfiguration | null>;
  backup(): Promise<GrubApplyResult>;
  apply(configuration: GrubConfiguration): Promise<GrubApplyResult>;
  regenerate(): Promise<GrubApplyResult>;
  verify(): Promise<GrubApplyResult>;
  rollback(): Promise<GrubApplyResult>;
  setDefault(entryId: string): Promise<GrubApplyResult>;
  setNext(entryId: string): Promise<GrubApplyResult>;
  listEntries(): Promise<readonly BootEntry[]>;
  applyTheme(theme: BootAssetRef | undefined, background: BootAssetRef | undefined): Promise<GrubApplyResult>;
}
