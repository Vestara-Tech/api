import { ThemeService } from '../theme/service/theme-service.js';
import { ThemeGenerationService, createThemeGenerationService } from '../theme/service/generation-service.js';
import type { AiGenerationPort } from '../theme/domain/generation.js';
import { builtinThemes } from '../theme/contributions/builtin.js';

export interface ThemePlatform {
  readonly service: ThemeService;
  readonly generation: ThemeGenerationService;
}

const noopAiPort: AiGenerationPort = {
  async generate() {
    return { content: '{}', usage: { inputTokens: 0, outputTokens: 0, latencyMs: 0 } };
  },
};

/** THEME — Composition root. Registers built-in light + dark themes. */
export function buildThemePlatform(aiPort: AiGenerationPort = noopAiPort): ThemePlatform {
  const service = new ThemeService();
  for (const theme of builtinThemes()) service.register(theme);
  const generation = createThemeGenerationService(aiPort, service);
  return { service, generation };
}
