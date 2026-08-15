import { notFound } from '../core/errors.js';
import type { BuilderContribution } from './contracts.js';

/**
 * BLD-X04 — Builder registry. Discovery mechanism: installed modules register
 * builder contributions; the Builder API/UI resolve by kind. Marketplace-
 * installed builders register here identically.
 */
export class BuilderRegistry {
  private readonly contributions = new Map<string, BuilderContribution>();

  register(contribution: BuilderContribution): void {
    this.contributions.set(contribution.kind, contribution);
  }

  resolve<T = unknown>(kind: string): BuilderContribution<T> {
    const contribution = this.contributions.get(kind);
    if (!contribution) throw notFound(`No builder for kind "${kind}"`);
    return contribution as BuilderContribution<T>;
  }

  has(kind: string): boolean {
    return this.contributions.has(kind);
  }

  listKinds(): readonly { kind: string; moduleId: string; version: string; capabilities: readonly string[] }[] {
    return [...this.contributions.values()].map((c) => ({ kind: c.kind, moduleId: c.moduleId, version: c.version, capabilities: c.capabilities }));
  }
}
