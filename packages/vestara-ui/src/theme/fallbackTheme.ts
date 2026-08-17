import { createTheme, type Theme, type ThemeOptions } from '@mui/material/styles';

import { builtinThemes, toMuiTheme, type ThemeDefinition } from '../../../../src/theme/index.js';

const builtinThemeList = builtinThemes();

export const fallbackThemeDefinition: ThemeDefinition =
  builtinThemeList.find((theme) => theme.id === 'vestara.dark') ?? builtinThemeList[0]!;

export function buildMuiThemeFromDefinition(theme: ThemeDefinition): Theme {
  return createTheme(toMuiTheme(theme) as ThemeOptions);
}

export function buildMuiThemeFromOptions(options: ThemeOptions): Theme {
  return createTheme(options);
}

export const fallbackMuiTheme = buildMuiThemeFromDefinition(fallbackThemeDefinition);
