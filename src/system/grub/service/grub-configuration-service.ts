import { badRequest, conflict, forbidden, notFound } from '../../../core/errors.js';
import type { GrubAdapter } from '../adapters/grub-adapter.js';
import type { GrubConfiguration, GrubConfigurationInput, GrubConfigurationSnapshot, GrubCapabilities } from '../domain/configuration.js';
import { normalizeGrubConfiguration, toSnapshot } from '../domain/configuration.js';
import { validateKernelParams } from '../domain/kernel-params.js';
import type { BootEntry } from '../../domain/boot.js';
import type { BootAssetRef } from '../../boot-presentation/domain/asset.js';
import type { BootAssetStore } from '../../boot-presentation/domain/asset.js';
import { InMemoryBootAssetStore } from '../../boot-presentation/domain/asset.js';
import { hashOf } from '../../../generator/domain/hash.js';

export type GrubApplyStatus = 'none' | 'applied' | 'pending-reboot-verification' | 'verified' | 'failed';

export interface GrubPreview {
  readonly current?: GrubConfigurationSnapshot;
  readonly candidate: GrubConfiguration;
  readonly candidateHash: string;
  readonly changed: boolean;
  readonly validation: { readonly ok: boolean; readonly issues: readonly string[] };
  readonly requiresReboot: boolean;
  readonly previewHash: string;
}

export interface GrubApplyState {
  status: GrubApplyStatus;
  bootAttempts: number;
  lastAppliedHash?: string;
}

export interface GrubConfigurationServiceOptions {
  readonly adapter: GrubAdapter;
  readonly assetStore?: BootAssetStore;
  readonly bootAttemptThreshold?: number;
}

export class GrubConfigurationService {
  private readonly adapter: GrubAdapter;
  private readonly assetStore: BootAssetStore;
  private readonly bootAttemptThreshold: number;
  private state: GrubApplyState = { status: 'none', bootAttempts: 0 };
  private knownGood: GrubConfigurationSnapshot | null = null;

  constructor(options: GrubConfigurationServiceOptions) {
    this.adapter = options.adapter;
    this.assetStore = options.assetStore ?? new InMemoryBootAssetStore();
    this.bootAttemptThreshold = options.bootAttemptThreshold ?? 3;
  }

  getState(): GrubApplyState {
    return this.state;
  }

  async capabilities(): Promise<GrubCapabilities> {
    const available = await this.adapter.discover();
    return {
      read: available.available,
      write: available.available,
      regenerate: available.available,
      backup: available.available,
      entries: available.available,
      theme: available.available,
    };
  }

  async read(): Promise<GrubConfiguration | null> {
    return this.adapter.read();
  }

  async listEntries(): Promise<readonly BootEntry[]> {
    return this.adapter.listEntries();
  }

  /** SYS-021 — Validate a proposed configuration (kernel params + structure). */
  async validate(input: GrubConfigurationInput): Promise<GrubPreview> {
    const candidate = normalizeGrubConfiguration(input);
    const kernel = validateKernelParams(candidate.kernelParameters);
    const issues: string[] = [];
    if (!kernel.ok) issues.push(`blocked kernel parameters: ${kernel.blocked.map((b) => b.parameter).join(', ')}`);
    if (candidate.timeoutSeconds < 0) issues.push('timeoutSeconds must be non-negative');

    const current = await this.adapter.read();
    const currentSnapshot = current ? toSnapshot(current) : null;
    const candidateHash = hashOf(candidate);
    const changed = currentSnapshot === null || currentSnapshot.configurationHash !== candidateHash;
    const requiresReboot = changed;

    return {
      ...(currentSnapshot !== null ? { current: currentSnapshot } : {}),
      candidate,
      candidateHash,
      changed,
      validation: { ok: issues.length === 0, issues },
      requiresReboot,
      previewHash: `${candidateHash.slice(0, 16)}:${changed ? 1 : 0}`,
    };
  }

  async preview(input: GrubConfigurationInput): Promise<GrubPreview> {
    return this.validate(input);
  }

  /**
   * SYS-022 — Governed apply:
   * validate → approval → snapshot known-good → apply → regenerate → verify →
   * pending-reboot-verification.
   */
  async apply(input: GrubConfigurationInput, approved: boolean): Promise<GrubPreview> {
    if (!approved) throw forbidden('GRUB configuration apply requires approval');
    const preview = await this.validate(input);
    if (!preview.validation.ok) throw badRequest('GRUB configuration validation failed', { issues: preview.validation.issues });
    if (!preview.changed) return preview;

    const backup = await this.adapter.backup();
    if (!backup.ok) throw conflict(`GRUB backup failed: ${backup.message ?? ''}`);

    // Snapshot current known-good before mutating.
    const current = await this.adapter.read();
    this.knownGood = current ? toSnapshot(current) : null;

    const applied = await this.adapter.apply(preview.candidate);
    if (!applied.ok) throw conflict(`GRUB apply failed: ${applied.message ?? ''}`);

    const regenerated = await this.adapter.regenerate();
    if (!regenerated.ok) throw conflict(`GRUB regenerate failed: ${regenerated.message ?? ''}`);

    const verified = await this.adapter.verify();
    if (!verified.ok) throw conflict(`GRUB verify failed: ${verified.message ?? ''}`);

    this.state = { status: 'pending-reboot-verification', bootAttempts: 0, lastAppliedHash: preview.candidateHash };
    return preview;
  }

  async recordBootResult(succeeded: boolean): Promise<GrubApplyState> {
    if (this.state.status !== 'pending-reboot-verification') return this.state;
    if (succeeded) {
      this.state = { ...this.state, status: 'verified', bootAttempts: 0 };
      return this.state;
    }
    const attempts = this.state.bootAttempts + 1;
    if (attempts >= this.bootAttemptThreshold) {
      await this.adapter.rollback().catch(() => undefined);
      this.state = { status: 'failed', bootAttempts: attempts };
    } else {
      this.state = { ...this.state, bootAttempts: attempts };
    }
    return this.state;
  }

  async rollback(): Promise<GrubApplyState> {
    const result = await this.adapter.rollback();
    if (!result.ok) throw conflict(`GRUB rollback failed: ${result.message ?? ''}`);
    this.state = { status: 'none', bootAttempts: 0 };
    return this.state;
  }

  // ── Boot-entry integration (SYS-019e) ───────────────────────

  async setDefault(entryId: string): Promise<{ ok: boolean; entryId: string }> {
    const entries = await this.adapter.listEntries();
    if (!entries.some((e) => e.id === entryId)) throw notFound(`GRUB entry "${entryId}" not found`);
    const result = await this.adapter.setDefault(entryId);
    if (!result.ok) throw conflict(`Failed to set default GRUB entry: ${result.message ?? ''}`);
    return { ok: true, entryId };
  }

  async setNext(entryId: string): Promise<{ ok: boolean; entryId: string }> {
    const entries = await this.adapter.listEntries();
    if (!entries.some((e) => e.id === entryId)) throw notFound(`GRUB entry "${entryId}" not found`);
    const result = await this.adapter.setNext(entryId);
    if (!result.ok) throw conflict(`Failed to set next GRUB entry: ${result.message ?? ''}`);
    return { ok: true, entryId };
  }

  // ── Theme (SYS-020) ─────────────────────────────────────────

  async assetExists(assetId: string): Promise<boolean> {
    return (await this.assetStore.get(assetId)) !== null;
  }

  async applyTheme(themeRef: BootAssetRef | undefined, backgroundRef: BootAssetRef | undefined): Promise<{ ok: boolean }> {
    for (const ref of [themeRef, backgroundRef].filter(Boolean) as BootAssetRef[]) {
      const asset = await this.assetStore.get(ref.assetId);
      if (!asset) throw notFound(`Theme asset "${ref.assetId}" not found`);
    }
    const result = await this.adapter.applyTheme(themeRef, backgroundRef);
    if (!result.ok) throw conflict(`GRUB theme apply failed: ${result.message ?? ''}`);
    return { ok: true };
  }
}
