import type { ContributionRegistryV2 } from './contributions.js';
import type { ContributionManifestV2, VestaraPackageKind } from './contracts.js';

export interface PlatformRegistryReads {
  readonly configurationContributions?: readonly { packageId: string; namespace: string }[];
  readonly aiProviders?: readonly { id: string; name: string; enabled?: boolean }[];
  readonly aiProfiles?: readonly { id: string; name: string }[];
  readonly aiEvaluators?: readonly { id: string; name?: string }[];
  readonly builders?: readonly { kind: string; moduleId: string; version: string }[];
  readonly generators?: readonly { id: string; capabilities?: readonly string[] }[];
  readonly components?: readonly { id: string; name: string }[];
  readonly themes?: readonly { id: string; name: string }[];
  readonly templates?: readonly { id: string; name: string; kind: string }[];
  readonly osComponents?: readonly { id: string; name: string }[];
  readonly imageProfiles?: readonly { id: string; version: string }[];
}

/**
 * MKT2-006..010 — Contribution wiring. Registers the live platform modules as
 * distributable Marketplace contributions so every module is independently
 * installable/updatable through the governed package system. Marketplace
 * distributes; modules execute their own contributions.
 */
export function registerPlatformContributions(registry: ContributionRegistryV2, platform: PlatformRegistryReads): void {
  const manifest = (provides: ContributionManifestV2['provides']): ContributionManifestV2 => ({
    provides,
    requires: [{ module: 'platform', capability: 'platform.runtime' }],
    optional: [],
  });

  const provides = (kind: VestaraPackageKind, list: readonly { id: string; name?: string }[]): ContributionManifestV2['provides'] =>
    list.map((item) => ({ kind, id: item.id, name: item.name ?? item.id }));

  // MKT2-006 — Configuration contributions.
  if (platform.configurationContributions && platform.configurationContributions.length > 0) {
    registry.register(
      'vestara.platform.configuration',
      '1.0.0',
      manifest(
        platform.configurationContributions.map((c) => ({ kind: 'service' as const, id: c.packageId, name: `${c.namespace} configuration` })),
      ),
    );
  }

  // MKT2-007 — AI provider/profile/evaluator contributions.
  if (platform.aiProviders && platform.aiProviders.length > 0) {
    registry.register(
      'vestara.platform.ai.providers',
      '1.0.0',
      manifest(provides('ai-provider', platform.aiProviders)),
    );
  }
  if (platform.aiProfiles && platform.aiProfiles.length > 0) {
    registry.register(
      'vestara.platform.ai.profiles',
      '1.0.0',
      manifest(provides('ai-profile', platform.aiProfiles)),
    );
  }
  if (platform.aiEvaluators && platform.aiEvaluators.length > 0) {
    registry.register(
      'vestara.platform.ai.evaluators',
      '1.0.0',
      manifest(provides('evaluator', platform.aiEvaluators)),
    );
  }

  // MKT2-008 — Builder/generator contributions.
  if (platform.builders && platform.builders.length > 0) {
    registry.register(
      'vestara.platform.builders',
      '1.0.0',
      manifest(
        platform.builders.map((b) => ({ kind: `${b.kind}-builder` as VestaraPackageKind, id: `${b.moduleId}.${b.kind}`, name: `${b.kind} builder` })),
      ),
    );
  }
  if (platform.generators && platform.generators.length > 0) {
    registry.register(
      'vestara.platform.generators',
      '1.0.0',
      manifest(
        platform.generators.map((g) => ({ kind: 'generator' as const, id: g.id, name: g.capabilities?.[0] ?? g.id })),
      ),
    );
  }

  // MKT2-009 — UI component/theme/template contributions.
  if (platform.components && platform.components.length > 0) {
    registry.register(
      'vestara.platform.ui.components',
      '1.0.0',
      manifest(provides('component', platform.components)),
    );
  }
  if (platform.themes && platform.themes.length > 0) {
    registry.register(
      'vestara.platform.ui.themes',
      '1.0.0',
      manifest(provides('theme', platform.themes)),
    );
  }
  if (platform.templates && platform.templates.length > 0) {
    registry.register(
      'vestara.platform.ui.templates',
      '1.0.0',
      manifest(provides('template', platform.templates)),
    );
  }

  // MKT2-010 — OS/image contributions.
  if (platform.osComponents && platform.osComponents.length > 0) {
    registry.register(
      'vestara.platform.os',
      '1.0.0',
      manifest(provides('os-component', platform.osComponents)),
    );
  }
  if (platform.imageProfiles && platform.imageProfiles.length > 0) {
    registry.register(
      'vestara.platform.image',
      '1.0.0',
      manifest(platform.imageProfiles.map((p) => ({ kind: 'image-profile' as const, id: p.id, name: `${p.id} image profile` }))),
    );
  }
}
