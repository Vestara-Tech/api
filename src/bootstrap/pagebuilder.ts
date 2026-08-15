import { PageService } from '../pagebuilder/service/page-service.js';
import type { ComponentRegistry } from '../component/registry/component-registry.js';

export interface PageBuilderPlatform {
  readonly service: PageService;
}

/** PAGE — Composition root. Pages validate against the Component Module. */
export function buildPageBuilderPlatform(components?: ComponentRegistry): PageBuilderPlatform {
  const service = new PageService({
    ...(components ? { componentResolver: { has: (id: string) => components.has(id) } } : {}),
  });
  return { service };
}
