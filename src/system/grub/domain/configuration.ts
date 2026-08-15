import { hashOf } from '../../../generator/domain/hash.js';
import type { BootAssetRef } from '../../boot-presentation/domain/asset.js';

export type GrubTimeoutStyle = 'menu' | 'countdown' | 'hidden';

export interface GrubGraphics {
  readonly mode?: string;
  readonly payload?: 'keep' | 'text';
}

export interface GrubPresentationRef {
  readonly theme?: BootAssetRef;
  readonly background?: BootAssetRef;
}

/**
 * SYS-019 — Supported GRUB semantics, not raw text.
 *
 * Vestara exposes a typed configuration model; it never lets API clients write
 * arbitrary `/etc/default/grub` or `grub.cfg` text.
 */
export interface GrubConfiguration {
  readonly defaultEntry?: string;
  readonly timeoutSeconds: number;
  readonly timeoutStyle: GrubTimeoutStyle;
  readonly distributor?: string;
  readonly kernelParameters: readonly string[];
  readonly graphics?: GrubGraphics;
  readonly recovery: { readonly enabled: boolean };
  readonly osProber: { readonly enabled: boolean };
  readonly presentation?: GrubPresentationRef;
}

export interface GrubConfigurationInput extends Omit<GrubConfiguration, 'timeoutSeconds' | 'recovery' | 'osProber' | 'kernelParameters'> {
  readonly timeoutSeconds?: number;
  readonly kernelParameters?: readonly string[];
  readonly recovery?: { readonly enabled: boolean };
  readonly osProber?: { readonly enabled: boolean };
}

export interface GrubConfigurationSnapshot {
  readonly configuration: GrubConfiguration;
  readonly configurationHash: string;
  readonly capturedAt: string;
}

export interface GrubCapabilities {
  readonly read: boolean;
  readonly write: boolean;
  readonly regenerate: boolean;
  readonly backup: boolean;
  readonly entries: boolean;
  readonly theme: boolean;
}

const DEFAULT_CONFIGURATION: GrubConfiguration = {
  timeoutSeconds: 5,
  timeoutStyle: 'countdown',
  kernelParameters: ['quiet', 'splash'],
  recovery: { enabled: true },
  osProber: { enabled: true },
};

export function normalizeGrubConfiguration(input: GrubConfigurationInput): GrubConfiguration {
  return {
    ...DEFAULT_CONFIGURATION,
    ...(input.defaultEntry !== undefined ? { defaultEntry: input.defaultEntry } : {}),
    ...(input.timeoutSeconds !== undefined ? { timeoutSeconds: input.timeoutSeconds } : {}),
    ...(input.timeoutStyle !== undefined ? { timeoutStyle: input.timeoutStyle } : {}),
    ...(input.distributor !== undefined ? { distributor: input.distributor } : {}),
    ...(input.kernelParameters !== undefined ? { kernelParameters: input.kernelParameters } : {}),
    ...(input.graphics !== undefined ? { graphics: input.graphics } : {}),
    ...(input.recovery !== undefined ? { recovery: input.recovery } : { recovery: DEFAULT_CONFIGURATION.recovery }),
    ...(input.osProber !== undefined ? { osProber: input.osProber } : { osProber: DEFAULT_CONFIGURATION.osProber }),
    ...(input.presentation !== undefined ? { presentation: input.presentation } : {}),
  };
}

export function hashGrubConfiguration(configuration: GrubConfiguration): string {
  return hashOf(configuration);
}

export function toSnapshot(configuration: GrubConfiguration): GrubConfigurationSnapshot {
  return {
    configuration,
    configurationHash: hashGrubConfiguration(configuration),
    capturedAt: new Date().toISOString(),
  };
}
