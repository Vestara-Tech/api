import { conflict, notFound } from '../core/errors.js';
import type { GenerationCapability, GeneratorContribution } from './contracts.js';

/**
 * GEN-X02 — Generation capability registry. Callers request a capability
 * ("agent.definition") not a generator id; the registry resolves compatible
 * generators. Marketplace-installed generators register here identically.
 */
export class GenerationCapabilityRegistry {
  private readonly capabilities = new Map<string, GenerationCapability[]>();
  private readonly contributions = new Map<string, GeneratorContribution>();

  registerContribution(contribution: GeneratorContribution): void {
    if (this.contributions.has(contribution.id)) throw conflict(`Generator contribution "${contribution.id}" already registered`);
    this.contributions.set(contribution.id, contribution);
    for (const capability of contribution.capabilities) {
      const list = this.capabilities.get(capability) ?? [];
      list.push({
        capability,
        generatorId: contribution.id,
        moduleId: contribution.moduleId,
        version: contribution.version,
        priority: list.length + 1,
      });
      this.capabilities.set(capability, list);
    }
  }

  resolve(capability: string): GenerationCapability {
    const list = this.capabilities.get(capability) ?? [];
    if (list.length === 0) throw notFound(`No generator provides capability "${capability}"`);
    return [...list].sort((a, b) => a.priority - b.priority)[0]!;
  }

  listCapabilities(): readonly string[] {
    return [...this.capabilities.keys()].sort();
  }

  listContributions(): readonly GeneratorContribution[] {
    return [...this.contributions.values()];
  }

  getContribution(id: string): GeneratorContribution {
    const contribution = this.contributions.get(id);
    if (!contribution) throw notFound(`Generator contribution "${id}" not found`);
    return contribution;
  }
}
