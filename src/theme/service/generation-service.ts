import type { ThemeService } from './theme-service.js';
import type { ThemeDefinition, ThemeTokens, ThemeMode, TypographyDefinition, SpacingDefinition, RadiusDefinition, ElevationDefinition, MotionDefinition, ComponentThemeOverride, ThemeAssets, ThemeMetadata } from '../domain/theme-definition.js';
import type {
  ThemeGenerationRequest,
  ThemeGenerationResult,
  ThemeProposal,
  ThemePatchProposal,
  ThemePatchOperation,
  SemanticTokenDraft,
  ThemePromptProfile,
  AiGenerationPort,
  ThemeGenerationServiceOptions,
} from '../domain/generation.js';
import { createEmptyTokenDraft, isValidThemeMode } from '../domain/generation.js';

const SYSTEM_PROMPT = `You are an expert theme designer for the Vestara design system. Convert natural language prompts into structured semantic token drafts.

Output MUST be valid JSON matching the SemanticTokenDraft schema. Do not emit raw CSS, SCSS, or any styling language as the primary artifact. The draft contains semantic tokens for colors, typography, spacing, radius, elevation, motion, components, assets, and metadata.

Color tokens MUST be valid hex strings (e.g., "#1a1a2e"). Semantic token keys follow the pattern: color.category.role (e.g., color.background.canvas, color.text.primary, color.brand.primary, color.status.success).

Accessibility: Target WCAG AA contrast ratios by default (4.5:1 for normal text, 3:1 for large text). If profile.accessibilityLevel is "AAA", target 7:1 / 4.5:1.

Consistency: Ensure light/dark/adaptive modes have coherent token structures. When mode is "adaptive", provide tokens that work for both light and dark contexts.

OS Adapter Compatibility: Tokens must be mappable to OS-level theming (GRUB, Plymouth, login, desktop). Avoid values that cannot be expressed in OS theming systems.

Component Overrides: Provide component-level token overrides in the "components" object with component keys and { props, styles } structure.`;

function buildUserPrompt(request: ThemeGenerationRequest): string {
  const { prompt, profile, baseThemeId } = request;
  const parts = [
    `User Prompt: ${prompt}`,
    profile ? `Profile: ${JSON.stringify(profile, null, 2)}` : '',
    baseThemeId ? `Base Theme ID: ${baseThemeId} (extend or modify this theme)` : '',
    'Output: Return a JSON object matching the SemanticTokenDraft schema.',
  ];
  return parts.filter(Boolean).join('\n\n');
}

function parseAiResponse(content: string): SemanticTokenDraft {
  try {
    const parsed = JSON.parse(content);
    return parsed as SemanticTokenDraft;
  } catch {
    return createEmptyTokenDraft();
  }
}

function createProposal(draft: SemanticTokenDraft, request: ThemeGenerationRequest, index: number): ThemeProposal {
  const mode = request.profile?.mode ?? 'light';
  const validMode = isValidThemeMode(mode) ? mode : 'light';
  const baseName = request.prompt.slice(0, 50).replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase() || 'generated-theme';
  return {
    id: `proposal-${Date.now()}-${index}`,
    name: `${baseName}-${index + 1}`,
    version: '0.1.0',
    mode: validMode,
    draft,
    rationale: `Generated from prompt: "${request.prompt}"${request.profile ? ` with profile ${JSON.stringify(request.profile)}` : ''}`,
    confidence: 0.85,
    warnings: [],
  };
}

function createPatches(baseThemeId: string, draft: SemanticTokenDraft): ThemePatchProposal[] {
  if (!baseThemeId) return [];
  const operations: ThemePatchOperation[] = [];
  for (const [category, tokens] of Object.entries(draft)) {
    if (tokens && typeof tokens === 'object') {
      for (const [key, value] of Object.entries(tokens)) {
        if (value !== undefined) {
          operations.push({ op: 'set', path: `${category}.${key}`, value });
        }
      }
    }
  }
  if (operations.length === 0) return [];
  return [{
    targetThemeId: baseThemeId,
    operations,
    rationale: `Patch operations to apply generated tokens to base theme ${baseThemeId}`,
    confidence: 0.8,
  }];
}

export class ThemeGenerationService {
  private readonly aiPort: AiGenerationPort;
  private readonly themeService: ThemeService;

  constructor(options: ThemeGenerationServiceOptions & { themeService: ThemeService }) {
    this.aiPort = options.aiService!;
    this.themeService = options.themeService;
  }

  async generate(request: ThemeGenerationRequest): Promise<ThemeGenerationResult> {
    const system = SYSTEM_PROMPT;
    const prompt = buildUserPrompt(request);
    const schema = {}; // Schema validation handled by validator

    const startedMs = Date.now();
    const response = await this.aiPort.generate({ system, prompt, schema, temperature: request.temperature ?? 0.3, maxTokens: request.maxTokens ?? 4000 });
    const latencyMs = Date.now() - startedMs;

    const draft = parseAiResponse(response.content);
    const proposal = createProposal(draft, request, 0);
    const patches = request.baseThemeId ? createPatches(request.baseThemeId, draft) : [];

    if (response.usage) {
      return {
        proposals: [proposal],
        patches,
        rawResponse: response.content,
        usage: {
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
          latencyMs,
        },
      };
    }
    return {
      proposals: [proposal],
      patches,
      rawResponse: response.content,
    };
  }
}

export function createThemeGenerationService(
  aiPort: AiGenerationPort,
  themeService: ThemeService,
): ThemeGenerationService {
  return new ThemeGenerationService({ aiService: aiPort, themeService });
}