import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createApplication } from '../../src/bootstrap/application.js';
import { loadConfig } from '../../src/config/schema.js';

let app: Awaited<ReturnType<typeof buildApp>>;

beforeEach(async () => {
  const config = loadConfig({});
  const application = createApplication(config);
  app = await buildApp({ config, application });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

const CUSTOM_THEME = {
  id: 'custom.gold', name: 'Custom Gold', version: '1.0.0', mode: 'dark',
  tokens: { 'color.brand.primary': '#B89B5E', 'color.background.canvas': '#101014', 'color.text.primary': '#ececf1' },
  typography: { fontFamily: 'Inter', fontSizeScale: 1.25, baseSizePx: 14, headingWeight: 600, bodyWeight: 400, lineHeight: 1.5 },
  spacing: { scale: [4, 8, 12], basePx: 4 },
  radius: { small: 4, medium: 8, large: 12, full: 999 },
  elevation: { levels: ['none'] },
  motion: { durationFastMs: 120, durationMediumMs: 240, durationSlowMs: 400, easing: 'ease' },
  components: {},
  assets: { wallpaper: 'gold.png' },
  metadata: { tags: ['gold'], mode: 'dark' },
};

describe('Theme control API', () => {
  it('lists built-in themes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/themes' });
    expect(res.statusCode).toBe(200);
    const themes = res.json();
    expect(themes.some((t: { id: string }) => t.id === 'vestara.light')).toBe(true);
    expect(themes.some((t: { id: string }) => t.id === 'vestara.dark')).toBe(true);
  });

  it('registers a custom theme and compiles adapters', async () => {
    const register = await app.inject({ method: 'POST', url: '/api/v2/themes', payload: CUSTOM_THEME });
    expect(register.statusCode).toBe(201);

    const get = await app.inject({ method: 'GET', url: '/api/v2/themes/custom.gold' });
    expect(get.json().mode).toBe('dark');

    const css = await app.inject({ method: 'GET', url: '/api/v2/themes/custom.gold/css' });
    expect(css.json().css).toContain('--vestara-color-brand-primary: #B89B5E');

    const mui = await app.inject({ method: 'GET', url: '/api/v2/themes/custom.gold/mui' });
    expect(mui.json().palette.primary.main).toBe('#B89B5E');
    expect(mui.json().palette.mode).toBe('dark');

    const os = await app.inject({ method: 'GET', url: '/api/v2/themes/custom.gold/os' });
    expect(os.json().grub.colorNormal).toBe('#B89B5E');
    expect(os.json().desktop.wallpaper).toBe('gold.png');
  });

  it('rejects invalid themes', async () => {
    const bad = { ...CUSTOM_THEME, id: 'bad', typography: { ...CUSTOM_THEME.typography, fontFamily: '' } };
    const res = await app.inject({ method: 'POST', url: '/api/v2/themes', payload: bad });
    expect(res.statusCode).toBe(409);
  });
});
