import { TemplateService } from '../template/service/template-service.js';
import { builtinTemplates } from '../template/contributions/builtin.js';

export interface TemplatePlatform {
  readonly service: TemplateService;
}

/** TPL — Composition root. Registers first-party templates across all kinds. */
export function buildTemplatePlatform(): TemplatePlatform {
  const service = new TemplateService();
  for (const template of builtinTemplates()) service.register(template);
  return { service };
}
