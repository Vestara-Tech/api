import type { SxProps, Theme } from '@mui/material/styles';

function appendResolved(target: Record<string, unknown>[], value: SxProps<Theme> | undefined, theme: Theme): void {
  if (value === undefined || value === null) return;

  if (Array.isArray(value)) {
    for (const entry of value) {
      appendResolved(target, entry, theme);
    }
    return;
  }

  const resolved = typeof value === 'function' ? value(theme) : value;
  if (resolved && typeof resolved === 'object') {
    target.push(resolved as Record<string, unknown>);
  }
}

export function mergeSx(...values: Array<SxProps<Theme> | undefined>): SxProps<Theme> {
  return (theme: Theme) => {
    const parts: Record<string, unknown>[] = [];
    for (const value of values) {
      appendResolved(parts, value, theme);
    }
    return Object.assign({}, ...parts);
  };
}
