import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { ThemeService } from '../theme/service/theme-service.js';
import type { ThemeGenerationService } from '../theme/service/generation-service.js';
import { validateThemeDraft } from '../theme/domain/generation-validator.js';
import type { ThemeGenerationRequest, ThemeGenerationResult, ThemeDraftValidationResult, SemanticTokenDraft, ThemePromptProfile, ThemeMode } from '../theme/domain/generation.js';
import { toMuiTheme, toCssRules } from '../theme/adapters/frontend.js';
import { osThemeContribution } from '../theme/contributions/os.js';

const TokenSchema = Type.Record(Type.String(), Type.Optional(Type.String()));

const ThemeSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  version: Type.String(),
  mode: Type.String(),
  tokens: TokenSchema,
  typography: Type.Object({ fontFamily: Type.String(), fontSizeScale: Type.Number(), baseSizePx: Type.Number(), headingWeight: Type.Integer(), bodyWeight: Type.Integer(), lineHeight: Type.Number() }),
  spacing: Type.Object({ scale: Type.Array(Type.Number()), basePx: Type.Number() }),
  radius: Type.Object({ small: Type.Integer(), medium: Type.Integer(), large: Type.Integer(), full: Type.Integer() }),
  elevation: Type.Object({ levels: Type.Array(Type.String()) }),
  motion: Type.Object({ durationFastMs: Type.Integer(), durationMediumMs: Type.Integer(), durationSlowMs: Type.Integer(), easing: Type.String() }),
  components: Type.Record(Type.String(), Type.Any()),
  assets: Type.Object({ logo: Type.Optional(Type.String()), wallpaper: Type.Optional(Type.String()), splash: Type.Optional(Type.String()) }),
  metadata: Type.Object({ author: Type.Optional(Type.String()), description: Type.Optional(Type.String()), tags: Type.Array(Type.String()), mode: Type.String() }),
});

const ThemePromptProfileSchema = Type.Object({
  mode: Type.Optional(Type.Union([Type.Literal('light'), Type.Literal('dark'), Type.Literal('adaptive')])),
  brandColors: Type.Optional(Type.Array(Type.String())),
  mood: Type.Optional(Type.Union([Type.Literal('professional'), Type.Literal('playful'), Type.Literal('minimal'), Type.Literal('bold'), Type.Literal('warm'), Type.Literal('cool'), Type.Literal('dark'), Type.Literal('light')])),
  density: Type.Optional(Type.Union([Type.Literal('compact'), Type.Literal('comfortable'), Type.Literal('spacious')])),
  radiusStyle: Type.Optional(Type.Union([Type.Literal('sharp'), Type.Literal('rounded'), Type.Literal('pill')])),
  elevationStyle: Type.Optional(Type.Union([Type.Literal('flat'), Type.Literal('layered'), Type.Literal('dramatic')])),
  motionStyle: Type.Optional(Type.Union([Type.Literal('subtle'), Type.Literal('standard'), Type.Literal('expressive')])),
  typographyPersonality: Type.Optional(Type.Union([Type.Literal('geometric'), Type.Literal('humanist'), Type.Literal('monospace'), Type.Literal('editorial'), Type.Literal('system')])),
  accessibilityLevel: Type.Optional(Type.Union([Type.Literal('AA'), Type.Literal('AAA')])),
  targetSurface: Type.Optional(Type.Union([Type.Literal('web'), Type.Literal('mobile'), Type.Literal('desktop'), Type.Literal('os'), Type.Literal('all')])),
  constraints: Type.Optional(Type.Record(Type.String(), Type.Any())),
});

const ThemeGenerationRequestSchema = Type.Object({
  prompt: Type.String({ minLength: 1 }),
  profile: Type.Optional(ThemePromptProfileSchema),
  baseThemeId: Type.Optional(Type.String()),
  model: Type.Optional(Type.Object({ provider: Type.Optional(Type.String()), model: Type.Optional(Type.String()) })),
  temperature: Type.Optional(Type.Number({ minimum: 0, maximum: 2 })),
  maxTokens: Type.Optional(Type.Integer({ minimum: 1, maximum: 8192 })),
});

const SemanticTokenDraftSchema = Type.Object({
  colors: Type.Optional(Type.Record(Type.String(), Type.Optional(Type.String()))),
  typography: Type.Optional(Type.Object({
    fontFamily: Type.Optional(Type.String()),
    fontSizeScale: Type.Optional(Type.Number()),
    baseSizePx: Type.Optional(Type.Number()),
    headingWeight: Type.Optional(Type.Integer()),
    bodyWeight: Type.Optional(Type.Integer()),
    lineHeight: Type.Optional(Type.Number()),
  })),
  spacing: Type.Optional(Type.Object({
    scale: Type.Optional(Type.Array(Type.Number())),
    basePx: Type.Optional(Type.Number()),
  })),
  radius: Type.Optional(Type.Object({
    small: Type.Optional(Type.Integer()),
    medium: Type.Optional(Type.Integer()),
    large: Type.Optional(Type.Integer()),
    full: Type.Optional(Type.Integer()),
  })),
  elevation: Type.Optional(Type.Object({
    levels: Type.Optional(Type.Array(Type.String())),
  })),
  motion: Type.Optional(Type.Object({
    durationFastMs: Type.Optional(Type.Integer()),
    durationMediumMs: Type.Optional(Type.Integer()),
    durationSlowMs: Type.Optional(Type.Integer()),
    easing: Type.Optional(Type.String()),
  })),
  components: Type.Optional(Type.Record(Type.String(), Type.Any())),
  assets: Type.Optional(Type.Object({
    logo: Type.Optional(Type.String()),
    icon: Type.Optional(Type.String()),
    wallpaper: Type.Optional(Type.String()),
    splash: Type.Optional(Type.String()),
    fontFiles: Type.Optional(Type.Array(Type.String())),
  })),
  metadata: Type.Optional(Type.Object({
    author: Type.Optional(Type.String()),
    description: Type.Optional(Type.String()),
    tags: Type.Optional(Type.Array(Type.String())),
    mode: Type.Optional(Type.Union([Type.Literal('light'), Type.Literal('dark'), Type.Literal('adaptive')])),
  })),
});

const ThemeProposalSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  version: Type.String(),
  mode: Type.Union([Type.Literal('light'), Type.Literal('dark'), Type.Literal('adaptive')]),
  draft: SemanticTokenDraftSchema,
  rationale: Type.String(),
  confidence: Type.Number({ minimum: 0, maximum: 1 }),
  warnings: Type.Array(Type.String()),
});

const ThemePatchOperationSchema = Type.Union([
  Type.Object({ op: Type.Literal('set'), path: Type.String(), value: Type.Any() }),
  Type.Object({ op: Type.Literal('add'), path: Type.String(), value: Type.Any() }),
  Type.Object({ op: Type.Literal('remove'), path: Type.String() }),
  Type.Object({ op: Type.Literal('replace'), path: Type.String(), value: Type.Any() }),
]);

const ThemePatchProposalSchema = Type.Object({
  targetThemeId: Type.String(),
  operations: Type.Array(ThemePatchOperationSchema),
  rationale: Type.String(),
  confidence: Type.Number({ minimum: 0, maximum: 1 }),
});

const ThemeGenerationResultSchema = Type.Object({
  proposals: Type.Array(ThemeProposalSchema),
  patches: Type.Array(ThemePatchProposalSchema),
  rawResponse: Type.Optional(Type.String()),
  usage: Type.Optional(Type.Object({
    inputTokens: Type.Integer(),
    outputTokens: Type.Integer(),
    latencyMs: Type.Integer(),
  })),
});

const ThemeDraftValidationIssueSchema = Type.Object({
  path: Type.String(),
  message: Type.String(),
  severity: Type.Union([Type.Literal('error'), Type.Literal('warning')]),
  code: Type.String(),
});

const ThemeDraftValidationResultSchema = Type.Object({
  ok: Type.Boolean(),
  issues: Type.Array(ThemeDraftValidationIssueSchema),
  correctedDraft: Type.Optional(SemanticTokenDraftSchema),
});

/** THEME — Theme control API. Register/resolve themes; compile to MUI/CSS/OS. */
export const themeRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const themes = app.application.container.resolve<ThemeService>('themes');
  const generationService = app.application.container.resolve<ThemeGenerationService>('theme-generation');

  app.get(
    '/api/v2/themes',
    {
      schema: {
        tags: ['themes'],
        summary: 'List themes',
        response: { 200: Type.Array(ThemeSchema) },
      },
    },
    async (_request, reply) => reply.send(themes.list() as never),
  );

  app.get(
    '/api/v2/themes/:id',
    {
      schema: {
        tags: ['themes'],
        summary: 'Get a theme',
        params: Type.Object({ id: Type.String() }),
        response: { 200: ThemeSchema },
      },
    },
    async (request, reply) => reply.send(themes.get(request.params.id) as never),
  );

  app.post(
    '/api/v2/themes',
    {
      schema: {
        tags: ['themes'],
        summary: 'Register a theme (validated)',
        body: ThemeSchema,
        response: { 201: ThemeSchema },
      },
    },
    async (request, reply) => reply.status(201).send(themes.register(request.body as never) as never),
  );

  app.get(
    '/api/v2/themes/:id/css',
    {
      schema: {
        tags: ['themes'],
        summary: 'Compile a theme to CSS custom properties',
        params: Type.Object({ id: Type.String() }),
        response: { 200: Type.Object({ css: Type.String() }) },
      },
    },
    async (request, reply) => reply.send({ css: toCssRules(themes.get(request.params.id)) } as never),
  );

  app.get(
    '/api/v2/themes/:id/mui',
    {
      schema: {
        tags: ['themes'],
        summary: 'Compile a theme to a MUI theme object',
        params: Type.Object({ id: Type.String() }),
        response: { 200: Type.Any() },
      },
    },
    async (request, reply) => reply.send(toMuiTheme(themes.get(request.params.id)) as never),
  );

  app.get(
    '/api/v2/themes/:id/os',
    {
      schema: {
        tags: ['themes'],
        summary: 'OS theme contribution (GRUB/Plymouth/login/desktop)',
        params: Type.Object({ id: Type.String() }),
        response: { 200: Type.Object({ themeId: Type.String(), grub: Type.Any(), plymouth: Type.Object({ theme: Type.String() }), login: Type.Any(), desktop: Type.Any(), shell: Type.Any() }) },
      },
    },
    async (request, reply) => reply.send(osThemeContribution(themes.get(request.params.id)) as never),
  );

  app.post(
    '/api/v2/themes/generate',
    {
      schema: {
        tags: ['themes'],
        summary: 'Generate theme proposals from a natural language prompt',
        body: ThemeGenerationRequestSchema,
        response: { 200: ThemeGenerationResultSchema },
      },
    },
    async (request, reply) => {
      const result = await generationService.generate(request.body as ThemeGenerationRequest);
      return reply.send(result as never);
    },
  );

  app.post(
    '/api/v2/themes/validate-draft',
    {
      schema: {
        tags: ['themes'],
        summary: 'Validate a semantic token draft',
        body: Type.Object({
          draft: SemanticTokenDraftSchema,
          accessibilityLevel: Type.Optional(Type.Union([Type.Literal('AA'), Type.Literal('AAA')])),
          mode: Type.Optional(Type.Union([Type.Literal('light'), Type.Literal('dark'), Type.Literal('adaptive')])),
        }),
        response: { 200: ThemeDraftValidationResultSchema },
      },
    },
    async (request, reply) => {
      const { draft, accessibilityLevel, mode } = request.body as { draft: SemanticTokenDraft; accessibilityLevel?: 'AA' | 'AAA'; mode?: 'light' | 'dark' | 'adaptive' };
      const opts: { accessibilityLevel?: 'AA' | 'AAA'; mode?: ThemeMode } = {};
      if (accessibilityLevel !== undefined) {
        opts.accessibilityLevel = accessibilityLevel;
      }
      if (mode !== undefined) {
        opts.mode = mode as ThemeMode;
      }
      const result = validateThemeDraft(draft, opts);
      return reply.send(result as never);
    },
  );
};
