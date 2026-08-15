import type { GenerationIntent } from './contracts.js';
import { GenerationCapabilityRegistry } from './capability-registry.js';
import type { GeneratorPermissionBridge } from './contracts.js';

export interface GenerationPlaneOptions {
  readonly registry: GenerationCapabilityRegistry;
  readonly permission?: GeneratorPermissionBridge;
}

export interface GenerationPlane {
  resolveGenerator(capability: string): { generatorId: string; moduleId: string; version: string };
  intentToCapability(intent: GenerationIntent): string;
  canGenerate(principalId: string, intent: GenerationIntent): Promise<boolean>;
  canApply(principalId: string, capability: string): Promise<boolean>;
  listCapabilities(): readonly string[];
}

/**
 * GEN-X — the cross-module generation plane. Deterministic infrastructure owns
 * execution: AI proposes intents, the plane resolves capabilities and gates
 * generate vs apply through the Permission bridge. Generator never writes
 * arbitrary files.
 */
export class GenerationPlane implements GenerationPlane {
  private readonly registry: GenerationCapabilityRegistry;
  private readonly permission: GeneratorPermissionBridge | undefined;

  constructor(options: GenerationPlaneOptions) {
    this.registry = options.registry;
    this.permission = options.permission;
  }

  resolveGenerator(capability: string): { generatorId: string; moduleId: string; version: string } {
    const cap = this.registry.resolve(capability);
    return { generatorId: cap.generatorId, moduleId: cap.moduleId, version: cap.version };
  }

  intentToCapability(intent: GenerationIntent): string {
    return intent.kind;
  }

  async canGenerate(principalId: string, intent: GenerationIntent): Promise<boolean> {
    if (!this.permission) return true;
    return this.permission.canGenerate(principalId, intent.kind);
  }

  async canApply(principalId: string, capability: string): Promise<boolean> {
    if (!this.permission) return true;
    return this.permission.canApply(principalId, capability);
  }

  listCapabilities(): readonly string[] {
    return this.registry.listCapabilities();
  }
}
