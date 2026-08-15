import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { ThemeService } from '../theme/service/theme-service.js';
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

/** THEME — Theme control API. Register/resolve themes; compile to MUI/CSS/OS. */
export const themeRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const themes = app.application.container.resolve<ThemeService>('themes');

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
};
