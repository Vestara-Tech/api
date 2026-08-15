import { hashOf } from '../../../generator/domain/hash.js';
import type { BootAssetRef } from './asset.js';

export interface PlymouthPresentation {
  readonly logo?: BootAssetRef;
  readonly animation?: BootAssetRef;
  readonly background?: BootAssetRef;
  readonly progressStyle?: 'minimal' | 'classic' | 'dots';
}

export interface GrubPresentation {
  readonly background?: BootAssetRef;
  readonly logo?: BootAssetRef;
  readonly theme?: BootAssetRef;
}

export interface FirmwarePresentation {
  readonly logo?: BootAssetRef;
}

export interface BootPresentationProfile {
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly plymouth?: PlymouthPresentation;
  readonly grub?: GrubPresentation;
  readonly firmware?: FirmwarePresentation;
  readonly profileHash: string;
}

/** SYS-015 — Build a profile with a deterministic hash over its content. */
export function createBootPresentationProfile(input: Omit<BootPresentationProfile, 'profileHash'>): BootPresentationProfile {
  return {
    id: input.id,
    version: input.version,
    name: input.name,
    ...(input.plymouth !== undefined ? { plymouth: input.plymouth } : {}),
    ...(input.grub !== undefined ? { grub: input.grub } : {}),
    ...(input.firmware !== undefined ? { firmware: input.firmware } : {}),
    profileHash: hashOf({
      id: input.id,
      version: input.version,
      name: input.name,
      plymouth: input.plymouth,
      grub: input.grub,
      firmware: input.firmware,
    }),
  };
}
