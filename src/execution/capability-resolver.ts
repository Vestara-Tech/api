import type { CapabilityRegistry, CapabilityRegistration } from '../capabilities/registry.js';
import type { ResolvedCapability, ResolvedIntent } from './domain/contracts.js';

export interface CapabilityResolution {
  readonly resolved: readonly ResolvedCapability[];
  readonly missing: readonly string[];
}

const INTENT_TO_NAMESPACES: Readonly<Record<string, readonly string[]>> = {
  generate: ['generator', 'verification'],
  build: ['components', 'themes', 'templates', 'workflows', 'tasks', 'generator', 'verification'],
  modify: ['workflows', 'tasks', 'generator', 'verification'],
  fix: ['workflows', 'tasks', 'generator', 'verification'],
  test: ['tests', 'verification'],
  verify: ['tests', 'verification'],
  inspect: ['components', 'themes', 'workflows', 'tasks'],
  configure: ['workflows', 'tasks', 'generator', 'verification'],
};

export class CapabilityResolver {
  constructor(private readonly registry: CapabilityRegistry) {}

  resolve(intent: ResolvedIntent): CapabilityResolution {
    const desired = new Set<string>([
      ...intent.requiredCapabilities,
      ...(INTENT_TO_NAMESPACES[intent.kind] ?? []),
    ]);

    const resolved: ResolvedCapability[] = [];
    const missing: string[] = [];
    for (const namespace of [...desired].sort()) {
      const capability = this.registry.get(namespace);
      if (!capability || !capability.enabled) {
        missing.push(namespace);
        continue;
      }
      resolved.push(toResolvedCapability(capability));
    }

    return { resolved, missing };
  }
}

function toResolvedCapability(capability: CapabilityRegistration): ResolvedCapability {
  return {
    namespace: capability.namespace,
    version: capability.version,
    permissions: capability.permissions,
    operations: capability.operations,
  };
}
