import { GenerationCapabilityRegistry } from '../generation-plane/capability-registry.js';
import { GenerationPlane } from '../generation-plane/generation-plane.js';
import { generationPlaneContributions } from '../generation-plane/contributions.js';
import type { GeneratorPermissionBridge } from '../generation-plane/contracts.js';

export interface GenerationPlanePlatformOptions {
  readonly permission?: GeneratorPermissionBridge;
}

export interface GenerationPlanePlatform {
  readonly registry: GenerationCapabilityRegistry;
  readonly plane: GenerationPlane;
}

/** GEN-X — Composition root. Registers the built-in cross-module generators. */
export function buildGenerationPlanePlatform(options: GenerationPlanePlatformOptions = {}): GenerationPlanePlatform {
  const registry = new GenerationCapabilityRegistry();
  for (const contribution of generationPlaneContributions()) {
    registry.registerContribution(contribution);
  }
  const plane = new GenerationPlane({ registry, ...(options.permission ? { permission: options.permission } : {}) });
  return { registry, plane };
}
