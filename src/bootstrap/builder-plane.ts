import { BuilderRegistry } from '../builder-plane/registry.js';
import { BuilderStore } from '../builder-plane/store.js';
import { BuilderLifecycle } from '../builder-plane/lifecycle.js';
import { BuilderPlane } from '../builder-plane/session.js';
import { apiBuilderContribution } from '../builder-plane/contributions/api.js';

export interface BuilderPlanePlatform {
  readonly registry: BuilderRegistry;
  readonly store: BuilderStore;
  readonly lifecycle: BuilderLifecycle;
  readonly plane: BuilderPlane;
}

/** BLD-X v2 — Composition root. Registers the API Builder contribution. */
export function buildBuilderPlanePlatform(): BuilderPlanePlatform {
  const registry = new BuilderRegistry();
  registry.register(apiBuilderContribution);
  const store = new BuilderStore();
  const lifecycle = new BuilderLifecycle(store, registry);
  const plane = new BuilderPlane(store, registry, lifecycle);
  return { registry, store, lifecycle, plane };
}
