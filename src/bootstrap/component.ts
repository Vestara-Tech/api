import { ComponentRegistry } from '../component/registry/component-registry.js';
import { ComponentService } from '../component/service/component-service.js';
import { builtinComponents } from '../component/contributions/builtin.js';

export interface ComponentPlatform {
  readonly registry: ComponentRegistry;
  readonly service: ComponentService;
}

/** COMP — Composition root. Registers the built-in core components. */
export function buildComponentPlatform(options: { resolveCapability?: (capability: string) => boolean } = {}): ComponentPlatform {
  const registry = new ComponentRegistry({ ...(options.resolveCapability ? { resolveCapability: options.resolveCapability } : {}) });
  for (const component of builtinComponents()) registry.register(component);
  const service = new ComponentService({ registry });
  return { registry, service };
}
