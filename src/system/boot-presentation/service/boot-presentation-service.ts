import { badRequest, conflict, forbidden } from '../../../core/errors.js';
import type { BootPresentationProfile } from '../domain/profile.js';
import { createBootPresentationProfile } from '../domain/profile.js';
import type { BootAsset } from '../domain/asset.js';
import { validateAsset } from '../domain/asset.js';
import type { BootAssetStore } from '../domain/asset.js';
import { InMemoryBootAssetStore } from '../domain/asset.js';
import type { PlymouthAdapter, GrubPresentationAdapter, ApplyResult } from '../adapters/presentation-adapters.js';
import type { FirmwareLogoAdapter, FirmwareLogoCapabilities } from '../adapters/firmware-logo.js';
import { UnsupportedFirmwareLogoAdapter } from '../adapters/firmware-logo.js';

export type PresentationApplyStatus = 'none' | 'applied' | 'pending-reboot-verification' | 'verified' | 'failed';

export interface PresentationChange {
  readonly target: 'plymouth' | 'grub' | 'firmware';
  readonly action: 'install' | 'update' | 'restore';
  readonly detail: string;
}

export interface PresentationPreview {
  readonly profile: BootPresentationProfile;
  readonly changes: readonly PresentationChange[];
  readonly validation: Array<{ target: string; ok: boolean; issues: readonly string[] }>;
  readonly requiresReboot: boolean;
  readonly previewHash: string;
}

export interface PresentationEvidence {
  readonly profileId: string;
  readonly profileHash: string;
  readonly appliedAt: string;
  readonly changes: readonly PresentationChange[];
  readonly evidenceHash: string;
}

export interface BootPresentationState {
  status: PresentationApplyStatus;
  currentProfileId?: string;
  pendingVerificationProfileId?: string;
  bootAttempts: number;
  lastEvidence?: PresentationEvidence;
}

export interface BootPresentationServiceOptions {
  readonly assetStore?: BootAssetStore;
  readonly plymouth?: PlymouthAdapter;
  readonly grub?: GrubPresentationAdapter;
  readonly firmwareLogo?: FirmwareLogoAdapter;
  readonly bootAttemptThreshold?: number;
}

const DEFAULT_BOOT_ATTEMPT_THRESHOLD = 3;

export class BootPresentationService {
  private readonly assetStore: BootAssetStore;
  private readonly plymouth: PlymouthAdapter | undefined;
  private readonly grub: GrubPresentationAdapter | undefined;
  private readonly firmwareLogo: FirmwareLogoAdapter;
  private readonly bootAttemptThreshold: number;
  private state: BootPresentationState = { status: 'none', bootAttempts: 0 };
  private readonly profiles = new Map<string, BootPresentationProfile>();

  constructor(options: BootPresentationServiceOptions = {}) {
    this.assetStore = options.assetStore ?? new InMemoryBootAssetStore();
    this.plymouth = options.plymouth;
    this.grub = options.grub;
    this.firmwareLogo = options.firmwareLogo ?? new UnsupportedFirmwareLogoAdapter();
    this.bootAttemptThreshold = options.bootAttemptThreshold ?? DEFAULT_BOOT_ATTEMPT_THRESHOLD;
  }

  getState(): BootPresentationState {
    return this.state;
  }

  async storeAsset(input: { name: string; bytes: Uint8Array; mediaType?: string }) {
    return this.assetStore.store(input);
  }

  async listAssets(): Promise<readonly BootAsset[]> {
    return this.assetStore.list();
  }

  async firmwareLogoCapabilities(): Promise<FirmwareLogoCapabilities> {
    return this.firmwareLogo.discover();
  }

  async saveProfile(input: Omit<BootPresentationProfile, 'profileHash'>): Promise<BootPresentationProfile> {
    const profile = createBootPresentationProfile(input);
    this.profiles.set(profile.id, profile);
    return profile;
  }

  async listProfiles(): Promise<readonly BootPresentationProfile[]> {
    return [...this.profiles.values()];
  }

  async getProfile(id: string): Promise<BootPresentationProfile | null> {
    return this.profiles.get(id) ?? null;
  }

  /** SYS-020 — Preview: validate + plan changes without applying. */
  async preview(profileId: string): Promise<PresentationPreview> {
    const profile = await this.getProfile(profileId);
    if (!profile) throw badRequest(`Unknown presentation profile "${profileId}"`);
    return this.buildPreview(profile);
  }

  /** SYS-021 — Governed apply: PROFILE → VALIDATE → PREVIEW → APPROVAL → APPLY. */
  async apply(profileId: string, approved: boolean): Promise<PresentationPreview> {
    if (!approved) throw forbidden('Presentation apply requires approval');
    const profile = await this.getProfile(profileId);
    if (!profile) throw badRequest(`Unknown presentation profile "${profileId}"`);

    const preview = await this.buildPreview(profile);
    if (preview.validation.some((v) => !v.ok)) {
      throw badRequest('Presentation validation failed', {
        issues: preview.validation.flatMap((v) => v.issues),
      });
    }

    const results: ApplyResult[] = [];
    for (const change of preview.changes) {
      results.push(await this.applyChange(change));
    }
    if (results.some((r) => !r.ok)) {
      throw badRequest('Presentation apply failed', {
        issues: results.map((r) => r.message).filter(Boolean),
      });
    }

    this.state = {
      status: preview.requiresReboot ? 'pending-reboot-verification' : 'verified',
      currentProfileId: profile.id,
      ...(preview.requiresReboot ? { pendingVerificationProfileId: profile.id } : {}),
      bootAttempts: 0,
      lastEvidence: {
        profileId: profile.id,
        profileHash: profile.profileHash,
        appliedAt: new Date().toISOString(),
        changes: preview.changes,
        evidenceHash: `${profile.profileHash.slice(0, 16)}:${preview.changes.length}`,
      },
    };
    return preview;
  }

  /** SYS-021 — Rollback across reboot: restore known-good when boot failed. */
  async recordBootResult(succeeded: boolean): Promise<BootPresentationState> {
    if (this.state.status !== 'pending-reboot-verification') return this.state;
    if (succeeded) {
      const next = { ...this.state, status: 'verified' as const, bootAttempts: 0 };
      delete next.pendingVerificationProfileId;
      this.state = next;
      return this.state;
    }
    const attempts = this.state.bootAttempts + 1;
    if (attempts >= this.bootAttemptThreshold) {
      this.state = {
        status: 'failed',
        ...(this.state.currentProfileId !== undefined ? { currentProfileId: this.state.currentProfileId } : {}),
        bootAttempts: attempts,
      };
      // Restore known-good presentation via adapters.
      await this.restoreKnownGood();
    } else {
      this.state = { ...this.state, bootAttempts: attempts };
    }
    return this.state;
  }

  async rollback(): Promise<BootPresentationState> {
    await this.restoreKnownGood();
    this.state = { status: 'none', bootAttempts: 0 };
    return this.state;
  }

  async firmareLogoPreview(assetId: string): Promise<{ willReplace: boolean; requiresReboot: boolean }> {
    const capabilities = await this.firmwareLogo.discover();
    if (!capabilities.replaceable) {
      throw conflict('Firmware logo replacement is not supported on this hardware', { reason: capabilities.reason });
    }
    const asset = await this.assetStore.get(assetId);
    if (!asset) throw badRequest(`Unknown asset "${assetId}"`);
    const valid = await this.firmwareLogo.validateAsset(asset);
    if (!valid.ok) throw badRequest(`Asset not valid for firmware logo: ${valid.reason}`);
    return this.firmwareLogo.plan(asset);
  }

  /** SYS-023 — Firmware-logo apply: requires UEFI adapter, backup, special policy. */
  async applyFirmwareLogo(assetId: string, specialPolicyApproved: boolean): Promise<{ ok: boolean; message?: string }> {
    if (!specialPolicyApproved) throw forbidden('Firmware logo replacement requires special-policy approval');
    const capabilities = await this.firmwareLogo.discover();
    if (!capabilities.replaceable || !capabilities.writable) {
      throw conflict('Firmware logo replacement is not supported on this hardware', { reason: capabilities.reason });
    }
    const asset = await this.assetStore.get(assetId);
    if (!asset) throw badRequest(`Unknown asset "${assetId}"`);
    const valid = await this.firmwareLogo.validateAsset(asset);
    if (!valid.ok) throw badRequest(`Asset not valid for firmware logo: ${valid.reason}`);
    const backup = await this.firmwareLogo.backup();
    if (!backup) throw conflict('Firmware logo apply requires a backup');
    const result = await this.firmwareLogo.apply(asset);
    return result;
  }

  async restoreFirmwareLogo(): Promise<{ ok: boolean; message?: string }> {
    const capabilities = await this.firmwareLogo.discover();
    if (!capabilities.restoreSupported) throw conflict('Firmware logo restore is not supported');
    return this.firmwareLogo.restore();
  }

  private async buildPreview(profile: BootPresentationProfile): Promise<PresentationPreview> {
    const changes: PresentationChange[] = [];
    const validation: PresentationPreview['validation'] = [];
    let requiresReboot = false;

    if (profile.plymouth) {
      const plymouthIssues: string[] = [];
      for (const ref of [profile.plymouth.logo, profile.plymouth.animation, profile.plymouth.background].filter(Boolean)) {
        const asset = ref ? await this.assetStore.get(ref.assetId) : null;
        if (!asset) plymouthIssues.push(`missing asset ${ref?.assetId}`);
        else {
          const result = validateAsset(asset, 'plymouth');
          plymouthIssues.push(...result.issues.map((i) => i.message));
        }
      }
      changes.push({ target: 'plymouth', action: 'install', detail: 'install Vestara Plymouth theme + initramfs rebuild' });
      requiresReboot = true;
      validation.push({ target: 'plymouth', ok: plymouthIssues.length === 0, issues: plymouthIssues });
    }

    if (profile.grub) {
      changes.push({ target: 'grub', action: 'install', detail: 'install Vestara GRUB theme fragment + regenerate grub.cfg' });
      validation.push({ target: 'grub', ok: true, issues: [] });
    }

    if (profile.firmware) {
      changes.push({ target: 'firmware', action: 'update', detail: 'replace firmware/OEM logo' });
      validation.push({ target: 'firmware', ok: true, issues: [] });
      requiresReboot = true;
    }

    return {
      profile,
      changes,
      validation,
      requiresReboot,
      previewHash: `${profile.profileHash.slice(0, 16)}:${changes.length}`,
    };
  }

  private async applyChange(change: PresentationChange): Promise<ApplyResult> {
    switch (change.target) {
      case 'plymouth':
        if (this.plymouth) return this.plymouth.installTheme({}, new Map());
        return { ok: true, message: 'plymouth adapter absent (no-op in this environment)' };
      case 'grub':
        if (this.grub) return this.grub.installTheme({}, new Map());
        return { ok: true, message: 'grub adapter absent (no-op in this environment)' };
      case 'firmware':
        return { ok: true, message: 'firmware handled via separate firmware-logo adapter' };
    }
  }

  private async restoreKnownGood(): Promise<void> {
    if (this.plymouth) await this.plymouth.restoreBackup().catch(() => undefined);
    if (this.grub) await this.grub.restoreBackup().catch(() => undefined);
  }
}
