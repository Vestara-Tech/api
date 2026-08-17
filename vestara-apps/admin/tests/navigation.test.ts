import { describe, expect, it } from 'vitest';

import { ADMIN_NAVIGATION, resolveAdminNavigation } from '../src/app/navigation/navigation.js';

describe('admin navigation', () => {
  it('marks routes available when the capability exists', () => {
    const resolved = resolveAdminNavigation(
      ADMIN_NAVIGATION,
      new Set(['dashboard', 'system', 'files', 'config', 'themes', 'templates']),
      '/admin/dashboard',
    );
    const dashboard = resolved.find((group) => group.id === 'overview')?.items.find((item) => item.id === 'dashboard');
    const system = resolved.find((group) => group.id === 'platform')?.items.find((item) => item.id === 'system');
    const files = resolved.find((group) => group.id === 'data')?.items.find((item) => item.id === 'files');
    const configuration = resolved.find((group) => group.id === 'manage')?.items.find((item) => item.id === 'configuration');
    const templates = resolved.find((group) => group.id === 'build')?.items.find((item) => item.id === 'templates');
    const themes = resolved.find((group) => group.id === 'system')?.items.find((item) => item.id === 'themes');

    expect(dashboard?.available).toBe(true);
    expect(dashboard?.selected).toBe(true);
    expect(system?.available).toBe(true);
    expect(files?.available).toBe(true);
    expect(configuration?.available).toBe(true);
    expect(templates?.available).toBe(true);
    expect(themes?.available).toBe(true);
  });

  it('marks routes unavailable when the capability is missing', () => {
    const resolved = resolveAdminNavigation(ADMIN_NAVIGATION, new Set(['dashboard']), '/admin/system');
    const system = resolved.find((group) => group.id === 'platform')?.items.find((item) => item.id === 'system');

    expect(system?.available).toBe(false);
  });
});
