import { ApplicationBuilderService } from '../appbuilder/service/application-builder-service.js';
import type { PageService } from '../pagebuilder/service/page-service.js';

export interface ApplicationBuilderPlatform {
  readonly service: ApplicationBuilderService;
}

/** APP — Composition root. Applications resolve their pages through the Page Builder. */
export function buildApplicationBuilderPlatform(pages: PageService): ApplicationBuilderPlatform {
  const service = new ApplicationBuilderService({
    pages: { get: (id) => pages.get(id), list: () => pages.list() },
  });
  return { service };
}
