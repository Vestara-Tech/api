/** TPL-006 — template contribution contract. */

import type { TemplateDefinition, TemplateKind } from '../domain/template-definition.js';

export interface TemplateContribution {
  readonly moduleId: string;
  readonly templates: readonly TemplateDefinition[];
}

export interface TemplateContributionSource {
  readonly contribute: () => readonly TemplateContribution[];
}
