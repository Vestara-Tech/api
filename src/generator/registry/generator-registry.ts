import { conflict, notFound } from '../../core/errors.js';
import type { Generator } from '../domain/contracts.js';

export interface CompatibilityResult {
  readonly compatible: boolean;
  readonly reason?: string;
  readonly requiredCapabilities: readonly string[];
  readonly providedCapabilities: readonly string[];
}

/**
 * GEN-002 — Generator registry.
 *
 * Registers generators as capabilities, supports discovery by capability, and
 * reports compatibility against a set of provided capabilities (e.g. what a
 * Marketplace module or the current installation can supply).
 */
export class GeneratorRegistry {
  private readonly generators = new Map<string, Generator>();

  register(generator: Generator): void {
    if (this.generators.has(generator.id)) {
      throw conflict(`Generator "${generator.id}" already registered`);
    }
    this.generators.set(generator.id, generator);
  }

  unregister(id: string): boolean {
    return this.generators.delete(id);
  }

  has(id: string): boolean {
    return this.generators.has(id);
  }

  get<TInput = unknown, TOutput = unknown>(id: string): Generator<TInput, TOutput> {
    const generator = this.generators.get(id);
    if (!generator) throw notFound(`Generator "${id}" not found`);
    return generator as Generator<TInput, TOutput>;
  }

  list(): readonly Generator[] {
    return [...this.generators.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  /** Discover generators that provide at least one of the given capabilities. */
  discover(capabilities?: readonly string[]): readonly Generator[] {
    if (!capabilities || capabilities.length === 0) return this.list();
    const wanted = new Set(capabilities);
    return this.list().filter((g) => g.capabilities.some((c) => wanted.has(c)));
  }

  /** Every capability offered by registered generators. */
  capabilities(): readonly string[] {
    const set = new Set<string>();
    for (const generator of this.generators.values()) {
      for (const capability of generator.capabilities) set.add(capability);
    }
    return [...set].sort();
  }

  /** Compatibility of a generator against the capabilities an environment provides. */
  compatibility(id: string, providedCapabilities: readonly string[]): CompatibilityResult {
    const generator = this.get(id);
    const required = generator.capabilities.filter((c) => c !== 'secrets' && c !== 'templates');
    const missing = required.filter((c) => !providedCapabilities.includes(c));
    if (missing.length > 0) {
      return {
        compatible: false,
        reason: `Missing capabilities: ${missing.join(', ')}`,
        requiredCapabilities: required,
        providedCapabilities,
      };
    }
    return {
      compatible: true,
      requiredCapabilities: required,
      providedCapabilities,
    };
  }
}
