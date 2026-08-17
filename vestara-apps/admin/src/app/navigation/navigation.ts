export interface AdminNavigationItem {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly path: string;
  readonly requiredCapabilities: readonly string[];
}

export interface AdminNavigationGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly AdminNavigationItem[];
}

export interface ResolvedAdminNavigationItem extends AdminNavigationItem {
  readonly href: string;
  readonly available: boolean;
  readonly selected: boolean;
}

export interface ResolvedAdminNavigationGroup extends AdminNavigationGroup {
  readonly items: readonly ResolvedAdminNavigationItem[];
}

export interface AdminCommand {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly href: string;
  readonly available: boolean;
  readonly keywords: readonly string[];
  readonly onSelect?: () => void;
}

export const ADMIN_NAVIGATION: readonly AdminNavigationGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', description: 'Platform overview and health', path: 'dashboard', requiredCapabilities: ['dashboard'] },
      { id: 'activity', label: 'Activity', description: 'Recent platform activity', path: 'activity', requiredCapabilities: ['dashboard'] },
      { id: 'notifications', label: 'Notifications', description: 'Alerts and notices', path: 'notifications', requiredCapabilities: ['dashboard'] },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    items: [
      { id: 'system', label: 'System', description: 'Hardware, services, storage, network', path: 'system', requiredCapabilities: ['system'] },
      { id: 'os', label: 'OS', description: 'Boot and OS presentation', path: 'os', requiredCapabilities: ['os'] },
      { id: 'ai', label: 'AI', description: 'AI health and runtime control', path: 'ai', requiredCapabilities: ['ai'] },
      { id: 'agents', label: 'Agents', description: 'Operational agent management', path: 'agents', requiredCapabilities: ['agents'] },
      { id: 'workflows', label: 'Workflows', description: 'Workflow control surfaces', path: 'workflows', requiredCapabilities: ['workflows'] },
      { id: 'tasks', label: 'Tasks', description: 'Tasks and milestones', path: 'tasks', requiredCapabilities: ['tasks'] },
    ],
  },
  {
    id: 'data',
    label: 'Data',
    items: [
      { id: 'database', label: 'Database', description: 'Database resources', path: 'database', requiredCapabilities: ['database'] },
      { id: 'files', label: 'Files', description: 'Workspace and artifact files', path: 'files', requiredCapabilities: ['files'] },
      { id: 'context', label: 'Context', description: 'Execution context and traces', path: 'context', requiredCapabilities: ['context'] },
    ],
  },
  {
    id: 'build',
    label: 'Build',
    items: [
      { id: 'builders', label: 'Builders', description: 'Builder status and controls', path: 'builders', requiredCapabilities: ['builder'] },
      { id: 'pages', label: 'Pages', description: 'Declarative page builder', path: 'pages', requiredCapabilities: ['page-builder'] },
      { id: 'dashboards', label: 'Dashboards', description: 'Dashboard builder and projections', path: 'dashboards', requiredCapabilities: ['dashboard'] },
      { id: 'applications', label: 'Applications', description: 'Application builder and models', path: 'applications', requiredCapabilities: ['application-builder'] },
      { id: 'templates', label: 'Templates', description: 'Template registry and instantiation', path: 'templates', requiredCapabilities: ['templates'] },
      { id: 'generator', label: 'Generator', description: 'Artifact generation control', path: 'generator', requiredCapabilities: ['generator'] },
      { id: 'components', label: 'Components', description: 'Reusable component registry', path: 'components', requiredCapabilities: ['components'] },
    ],
  },
  {
    id: 'manage',
    label: 'Manage',
    items: [
      { id: 'marketplace', label: 'Marketplace', description: 'Installed packages and distribution', path: 'marketplace', requiredCapabilities: ['marketplace-v2'] },
      { id: 'modules', label: 'Modules', description: 'Installed modules and contributions', path: 'modules', requiredCapabilities: ['marketplace-v2'] },
      { id: 'integrations', label: 'Integrations', description: 'Application integration surface', path: 'integrations', requiredCapabilities: ['application-builder'] },
      { id: 'configuration', label: 'Configuration', description: 'Scope resolution and provenance', path: 'configuration', requiredCapabilities: ['config'] },
      { id: 'users', label: 'Users', description: 'Identity and user management', path: 'users', requiredCapabilities: ['users'] },
      { id: 'authentication', label: 'Authentication', description: 'Sessions and auth flows', path: 'authentication', requiredCapabilities: ['auth'] },
      { id: 'permissions', label: 'Permissions', description: 'Capabilities and grants', path: 'permissions', requiredCapabilities: ['permissions'] },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { id: 'diagnostics', label: 'Diagnostics', description: 'System diagnostics', path: 'diagnostics', requiredCapabilities: ['diagnostics'] },
      { id: 'logs', label: 'Logs', description: 'Application and system logs', path: 'logs', requiredCapabilities: ['logs'] },
      { id: 'evidence', label: 'Evidence', description: 'Verification evidence bundles', path: 'evidence', requiredCapabilities: ['tests'] },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { id: 'settings', label: 'Settings', description: 'General system settings', path: 'settings', requiredCapabilities: [] },
      { id: 'themes', label: 'Themes', description: 'Theme registry and compiled adapters', path: 'themes', requiredCapabilities: ['themes'] },
      { id: 'security', label: 'Security', description: 'Security posture and controls', path: 'security', requiredCapabilities: ['permissions'] },
      { id: 'about', label: 'About', description: 'Build and environment info', path: 'about', requiredCapabilities: [] },
    ],
  },
];

export function resolveAdminNavigation(
  groups: readonly AdminNavigationGroup[],
  enabledCapabilities: ReadonlySet<string>,
  pathname: string,
  optimistic = false,
): readonly ResolvedAdminNavigationGroup[] {
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      const available = optimistic || item.requiredCapabilities.every((capability) => enabledCapabilities.has(capability));
      const href = `/admin/${item.path}`;
      const selected = pathname === href || pathname.startsWith(`${href}/`);
      return { ...item, href, available, selected };
    }),
  }));
}

export function buildNavigationCommands(
  groups: readonly ResolvedAdminNavigationGroup[],
): readonly AdminCommand[] {
  return groups.flatMap((group) =>
    group.items.map((item) => ({
      id: item.id,
      label: item.label,
      description: item.description,
      href: item.href,
      available: item.available,
      keywords: [group.label, item.label, item.description].filter(Boolean),
    })),
  );
}
