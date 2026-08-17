export interface WorkspaceNavigationItem {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly path: string;
  readonly requiredCapabilities: readonly string[];
}

export interface WorkspaceNavigationGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly WorkspaceNavigationItem[];
}

export interface ResolvedWorkspaceNavigationItem extends WorkspaceNavigationItem {
  readonly href: string;
  readonly available: boolean;
  readonly selected: boolean;
}

export interface ResolvedWorkspaceNavigationGroup extends WorkspaceNavigationGroup {
  readonly items: readonly ResolvedWorkspaceNavigationItem[];
}

export const WORKSPACE_NAVIGATION: readonly WorkspaceNavigationGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [{ id: 'overview', label: 'Overview', description: 'Composition workspace overview', path: 'overview', requiredCapabilities: [] }],
  },
  {
    id: 'compose',
    label: 'Compose',
    items: [
      { id: 'components', label: 'Components', description: 'Reusable UI primitives and slots', path: 'components', requiredCapabilities: ['components'] },
      { id: 'templates', label: 'Templates', description: 'Template registry and instantiation', path: 'templates', requiredCapabilities: ['templates'] },
      { id: 'pages', label: 'Pages', description: 'Declarative page composition', path: 'pages', requiredCapabilities: ['page-builder'] },
      { id: 'dashboards', label: 'Dashboards', description: 'Dashboard composition and widgets', path: 'dashboards', requiredCapabilities: ['dashboard'] },
      { id: 'applications', label: 'Applications', description: 'Application models and routes', path: 'applications', requiredCapabilities: ['application-builder'] },
    ],
  },
  {
    id: 'build',
    label: 'Build',
    items: [{ id: 'generator', label: 'Generator', description: 'Artifact generation and preview', path: 'generator', requiredCapabilities: ['generator'] }],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { id: 'themes', label: 'Themes', description: 'Theme catalog and design tokens', path: 'themes', requiredCapabilities: ['themes'] },
      { id: 'files', label: 'Files', description: 'Workspace files and provider coverage', path: 'files', requiredCapabilities: [] },
      { id: 'configuration', label: 'Configuration', description: 'Resolved values and provenance', path: 'configuration', requiredCapabilities: [] },
    ],
  },
];

export function resolveWorkspaceNavigation(
  groups: readonly WorkspaceNavigationGroup[],
  enabledCapabilities: ReadonlySet<string>,
  pathname: string,
  optimistic = false,
): readonly ResolvedWorkspaceNavigationGroup[] {
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      const available = optimistic || item.requiredCapabilities.every((capability) => enabledCapabilities.has(capability));
      const href = `/workspace/${item.path}`;
      const selected = pathname === href || pathname.startsWith(`${href}/`);
      return { ...item, href, available, selected };
    }),
  }));
}
