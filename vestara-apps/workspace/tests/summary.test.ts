import { describe, expect, it } from 'vitest';

import type {
  ApplicationView,
  ComponentView,
  ConfigContributionView,
  ConfigFieldView,
  ConfigSchemaView,
  DashboardView,
  FileWorkspaceView,
  GeneratorDescriptorView,
  PageDefinitionView,
  ResolvedConfigValueView,
  TemplateView,
  ThemeView,
} from '../src/api/contracts.js';
import {
  summarizeApplications,
  summarizeComponents,
  summarizeConfiguration,
  summarizeDashboards,
  summarizeFiles,
  summarizeGenerators,
  summarizePages,
  summarizeTemplates,
  summarizeThemes,
} from '../src/app/utils/summaries.js';

describe('workspace summary helpers', () => {
  it('summarizes components', () => {
    const components: readonly ComponentView[] = [
      {
        id: 'component.button',
        name: 'button',
        displayName: 'Button',
        version: '1.0.0',
        category: 'controls',
        status: 'ready',
        capabilities: ['forms', 'inputs'],
        slots: [{ name: 'start' }],
        events: [{ name: 'click', kind: 'ui' }],
      },
      {
        id: 'component.card',
        name: 'card',
        displayName: 'Card',
        version: '1.0.0',
        category: 'layout',
        status: 'draft',
        capabilities: ['layout'],
        slots: [{ name: 'header' }, { name: 'content' }],
        events: [{ name: 'select', kind: 'ui' }, { name: 'close', kind: 'ui' }],
      },
    ];

    expect(summarizeComponents(components)).toEqual({
      totalComponents: 2,
      readyComponents: 1,
      uniqueCapabilities: 3,
      totalSlots: 3,
      totalEvents: 3,
    });
  });

  it('summarizes templates', () => {
    const templates: readonly TemplateView[] = [
      {
        id: 'template.system',
        name: 'system',
        version: '1.0.0',
        kind: 'layout',
        description: 'System layout',
        tags: ['admin', 'system'],
        parameters: [
          { name: 'title', type: 'string', required: true, defaultValue: 'Vestara', description: 'Display title' },
          { name: 'compact', type: 'boolean', defaultValue: false, description: 'Compact mode' },
        ],
        recommendedThemeId: 'theme.dark',
        requiredCapabilities: ['templates', 'themes'],
        metadata: { author: 'Vestara', version: '1.0.0', license: 'MIT', tags: ['shell'] },
      },
      {
        id: 'template.empty',
        name: 'empty',
        version: '1.0.0',
        kind: 'page',
        tags: ['starter'],
        parameters: [],
        requiredCapabilities: ['templates'],
        metadata: { version: '1.0.0', tags: [] },
      },
    ];

    expect(summarizeTemplates(templates)).toEqual({
      totalTemplates: 2,
      themedTemplates: 1,
      totalParameters: 2,
      uniqueRequiredCapabilities: 2,
      totalTags: 3,
    });
  });

  it('summarizes pages', () => {
    const pages: readonly PageDefinitionView[] = [
      {
        id: 'page.dashboard',
        name: 'dashboard',
        route: '/dashboard',
        layout: { type: 'grid', content: {} },
        nodes: [{ id: 'node-1' }, { id: 'node-2' }],
        dataSources: [{ id: 'api-1' }],
        actions: [{ id: 'refresh' }],
        permissions: [{ id: 'view' }],
        responsive: [{ breakpoint: 'lg' }],
        metadata: { title: 'Dashboard', authRequired: true },
        revision: 3,
        updatedAt: '2026-08-17T00:00:00.000Z',
      },
      {
        id: 'page.activity',
        name: 'activity',
        route: '/activity',
        layout: { type: 'stack', content: {} },
        nodes: [{ id: 'node-3' }],
        dataSources: [{ id: 'api-2' }, { id: 'api-3' }],
        actions: [],
        permissions: [],
        responsive: [],
        metadata: { title: 'Activity', authRequired: false },
        revision: 1,
        updatedAt: '2026-08-16T00:00:00.000Z',
      },
    ];

    expect(summarizePages(pages)).toEqual({
      totalPages: 2,
      authRequiredPages: 1,
      totalNodes: 3,
      totalDataSources: 3,
      totalActions: 1,
    });
  });

  it('summarizes dashboards', () => {
    const dashboards: readonly DashboardView[] = [
      {
        id: 'dashboard.system',
        name: 'System',
        description: 'System health',
        scope: 'platform',
        layout: { columns: 12, rowHeight: 24, gap: 16, placements: [{ widgetId: 'w1' }] },
        widgets: [
          {
            id: 'w1',
            type: 'health',
            title: 'Health',
            configuration: {},
            placement: { x: 0, y: 0, width: 6, height: 4, breakpoint: 'lg' },
            refreshIntervalSeconds: 30,
            state: 'ready',
            lastUpdatedAt: '2026-08-17T00:00:00.000Z',
          },
          {
            id: 'w2',
            type: 'activity',
            configuration: {},
            placement: { x: 6, y: 0, width: 6, height: 4, breakpoint: 'lg' },
            state: 'stale',
          },
        ],
        filters: [],
        refreshPolicy: { mode: 'interval', intervalSeconds: 60 },
        ownerUserId: 'user-1',
        revision: 2,
        createdAt: '2026-08-15T00:00:00.000Z',
        updatedAt: '2026-08-17T00:00:00.000Z',
        publishedAt: '2026-08-17T00:00:00.000Z',
      },
      {
        id: 'dashboard.ops',
        name: 'Operations',
        scope: 'operations',
        layout: { columns: 12, rowHeight: 24, gap: 16, placements: [{ widgetId: 'w3' }, { widgetId: 'w4' }] },
        widgets: [
          {
            id: 'w3',
            type: 'alerts',
            configuration: {},
            placement: { x: 0, y: 0, width: 12, height: 4, breakpoint: 'lg' },
            state: 'healthy',
          },
        ],
        filters: [],
        refreshPolicy: { mode: 'live' },
        revision: 1,
        createdAt: '2026-08-10T00:00:00.000Z',
        updatedAt: '2026-08-17T00:00:00.000Z',
      },
    ];

    expect(summarizeDashboards(dashboards)).toEqual({
      totalDashboards: 2,
      publishedDashboards: 1,
      totalWidgets: 3,
      totalPlacements: 3,
      scopes: 2,
    });
  });

  it('summarizes applications', () => {
    const applications: readonly ApplicationView[] = [
      {
        id: 'app.admin',
        name: 'Admin',
        version: '1.0.0',
        applicationType: 'control-plane',
        pages: [
          { pageId: 'page.dashboard', path: '/dashboard', default: true },
          { pageId: 'page.activity', path: '/activity' },
        ],
        routes: [
          { path: '/dashboard', pageId: 'page.dashboard', authRequired: true },
          { path: '/activity', pageId: 'page.activity', authRequired: true },
        ],
        navigation: [],
        apis: [],
        databases: [],
        authentication: { enabled: true, provider: 'local' },
        permissions: [],
        workflows: ['workflow.admin'],
        agents: ['agent.ops'],
        configuration: ['config.admin'],
        integrations: ['integration.logs'],
        state: [],
        lifecycle: 'published',
        revision: 4,
        updatedAt: '2026-08-17T00:00:00.000Z',
      },
      {
        id: 'app.workspace',
        name: 'Workspace',
        version: '0.1.0',
        applicationType: 'authoring',
        pages: [{ pageId: 'page.workspace', path: '/workspace' }],
        routes: [{ path: '/workspace', pageId: 'page.workspace', authRequired: false }],
        navigation: [],
        apis: [],
        databases: [],
        authentication: { enabled: false, provider: 'none' },
        permissions: [],
        workflows: [],
        agents: [],
        configuration: [],
        integrations: [],
        state: [],
        lifecycle: 'draft',
        revision: 1,
        updatedAt: '2026-08-16T00:00:00.000Z',
      },
    ];

    expect(summarizeApplications(applications)).toEqual({
      totalApplications: 2,
      publishedApplications: 1,
      authEnabledApplications: 1,
      integratedApplications: 1,
      totalRoutes: 3,
      totalPages: 3,
    });
  });

  it('summarizes generators', () => {
    const generators: readonly GeneratorDescriptorView[] = [
      { id: 'generator.react', version: '1.0.0', capabilities: ['react', 'docs'], requiresSecrets: false },
      { id: 'generator.test', version: '1.1.0', capabilities: ['react', 'test'], requiresSecrets: true },
    ];

    expect(summarizeGenerators(generators)).toEqual({
      totalGenerators: 2,
      uniqueCapabilities: 3,
      secretGenerators: 1,
      distinctVersions: 2,
    });
  });

  it('summarizes themes', () => {
    const themes: readonly ThemeView[] = [
      {
        id: 'theme.dark',
        name: 'Vestara Dark',
        version: '1.0.0',
        mode: 'dark',
        tokens: {
          'color.brand.primary': '#B89B5E',
          'surface.base': '#111111',
        },
        typography: {
          fontFamily: 'Inter',
          fontSizeScale: 1,
          baseSizePx: 16,
          headingWeight: 700,
          bodyWeight: 400,
          lineHeight: 1.5,
        },
        spacing: { scale: [0, 4, 8], basePx: 8 },
        radius: { small: 4, medium: 8, large: 12, full: 9999 },
        elevation: { levels: ['0px 1px 2px rgba(0,0,0,0.2)'] },
        motion: { durationFastMs: 100, durationMediumMs: 200, durationSlowMs: 300, easing: 'ease-out' },
        components: {},
        assets: {},
        metadata: { tags: ['dark', 'brand'], mode: 'dark' },
      },
      {
        id: 'theme.light',
        name: 'Vestara Light',
        version: '1.0.0',
        mode: 'light',
        tokens: {
          'color.brand.primary': '#B89B5E',
        },
        typography: {
          fontFamily: 'Inter',
          fontSizeScale: 1,
          baseSizePx: 16,
          headingWeight: 700,
          bodyWeight: 400,
          lineHeight: 1.5,
        },
        spacing: { scale: [0, 4, 8], basePx: 8 },
        radius: { small: 4, medium: 8, large: 12, full: 9999 },
        elevation: { levels: [] },
        motion: { durationFastMs: 100, durationMediumMs: 200, durationSlowMs: 300, easing: 'ease-in' },
        components: {},
        assets: {},
        metadata: { tags: ['light'], mode: 'light' },
      },
    ];

    expect(summarizeThemes(themes)).toEqual({
      totalThemes: 2,
      darkThemes: 1,
      lightThemes: 1,
      systemThemes: 0,
      totalTokens: 3,
    });
  });

  it('summarizes files', () => {
    const workspaces: readonly FileWorkspaceView[] = [
      { id: 'ws-1', name: 'Workspace 1', root: '/workspace', providerId: 'local', include: ['src'], exclude: ['dist'], revision: 3 },
      { id: 'ws-2', name: 'Workspace 2', root: '/workspace-2', providerId: 'local', include: ['assets', 'tests'], revision: 5 },
    ];

    expect(summarizeFiles(workspaces)).toEqual({
      totalWorkspaces: 2,
      providers: 1,
      includeRules: 3,
      excludeRules: 1,
      latestRevision: 5,
    });
  });

  it('summarizes configuration inventory', () => {
    const schemas: readonly ConfigSchemaView[] = [
      { namespace: 'workspace', version: '1.0.0', scope: ['workspace'], secretFields: ['api.token'] },
      { namespace: 'platform', version: '1.0.0', scope: ['platform'] },
    ];
    const apiTokenField: ConfigFieldView = { key: 'api.token', title: 'API Token', type: 'string', required: true, secret: true, reloadBehavior: 'restart', risk: 'critical' };
    const workspaceNameField: ConfigFieldView = { key: 'workspace.name', title: 'Workspace Name', type: 'string', required: true, reloadBehavior: 'live', risk: 'low' };
    const featureFlagField: ConfigFieldView = { key: 'feature.flag', title: 'Feature Flag', type: 'boolean', reloadBehavior: 'live', risk: 'medium' };
    const fields: readonly ConfigFieldView[] = [apiTokenField, workspaceNameField, featureFlagField];
    const contributions: readonly ConfigContributionView[] = [
      { packageId: 'pkg.workspace', namespace: 'workspace', version: '1.0.0', fields: [apiTokenField, workspaceNameField] },
      { packageId: 'pkg.platform', namespace: 'platform', version: '1.0.0', fields: [featureFlagField] },
    ];
    const resolved: readonly ResolvedConfigValueView[] = [
      { key: 'api.token', value: 'secret', scope: 'workspace', source: 'workspace', secret: true },
      { key: 'workspace.name', value: 'Vestara', scope: 'workspace', source: 'default', secret: false },
      { key: 'feature.flag', value: true, scope: 'platform', source: 'environment', secret: false },
    ];

    expect(
      summarizeConfiguration({
        schemas,
        fields,
        contributions,
        resolved,
      }),
    ).toEqual({
      totalSchemas: 2,
      totalFields: 3,
      totalContributions: 2,
      totalResolved: 3,
      secretFields: 1,
      requiredFields: 2,
      highRiskFields: 1,
      contributedFields: 3,
    });
  });
});
