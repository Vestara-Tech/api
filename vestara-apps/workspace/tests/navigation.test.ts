import { describe, expect, it } from 'vitest';

import { WORKSPACE_NAVIGATION, resolveWorkspaceNavigation } from '../src/app/navigation/navigation.js';

describe('workspace navigation', () => {
  it('marks authoring routes available when the capability exists', () => {
    const resolved = resolveWorkspaceNavigation(
      WORKSPACE_NAVIGATION,
      new Set(['components', 'templates', 'page-builder', 'dashboard', 'application-builder', 'generator', 'themes', 'files', 'config']),
      '/workspace/overview',
    );

    const compose = resolved.find((group) => group.id === 'compose');
    const system = resolved.find((group) => group.id === 'system');
    const components = compose?.items.find((item) => item.id === 'components');
    const templates = compose?.items.find((item) => item.id === 'templates');
    const generator = resolved.find((group) => group.id === 'build')?.items.find((item) => item.id === 'generator');
    const configuration = system?.items.find((item) => item.id === 'configuration');

    expect(components?.available).toBe(true);
    expect(templates?.available).toBe(true);
    expect(generator?.available).toBe(true);
    expect(configuration?.available).toBe(true);
  });

  it('marks routes unavailable when a capability is missing', () => {
    const resolved = resolveWorkspaceNavigation(WORKSPACE_NAVIGATION, new Set(['components']), '/workspace/components');
    const templates = resolved.find((group) => group.id === 'compose')?.items.find((item) => item.id === 'templates');
    const files = resolved.find((group) => group.id === 'system')?.items.find((item) => item.id === 'files');
    const configuration = resolved.find((group) => group.id === 'system')?.items.find((item) => item.id === 'configuration');

    expect(templates?.available).toBe(false);
    expect(files?.available).toBe(true);
    expect(configuration?.available).toBe(true);
  });
});
