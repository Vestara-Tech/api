import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { VestaraThemeProvider } from '@vestara/ui';

import {
  resetUseAsyncStateImplementationForTests,
  setUseAsyncStateImplementationForTests,
} from '../src/app/hooks/useAsyncState.js';
import {
  resetWorkspaceApiClientFactoryForTests,
  setWorkspaceApiClientFactoryForTests,
} from '../src/app/hooks/useWorkspaceApiClient.js';

import { ApplicationsPage } from '../src/pages/ApplicationsPage.js';
import { ComponentsPage } from '../src/pages/ComponentsPage.js';
import { ConfigurationPage } from '../src/pages/ConfigurationPage.js';
import { DashboardsPage } from '../src/pages/DashboardsPage.js';
import { FilesPage } from '../src/pages/FilesPage.js';
import { GeneratorPage } from '../src/pages/GeneratorPage.js';
import { PagesPage } from '../src/pages/PagesPage.js';
import { TemplatesPage } from '../src/pages/TemplatesPage.js';
import { ThemesPage } from '../src/pages/ThemesPage.js';

import type {
  ApplicationView,
  ComponentCategoryView,
  ComponentView,
  ConfigContributionView,
  ConfigFieldView,
  ConfigSchemaView,
  DashboardView,
  FileEventView,
  FileWorkspaceView,
  GeneratorDescriptorView,
  PageDefinitionView,
  ResolvedConfigValueView,
  TemplateView,
  ThemeView,
} from '../src/api/contracts.js';

const mockStateQueue: unknown[] = [];

type ReadyAsyncState = {
  readonly status: 'ready';
  readonly data: unknown;
};

beforeEach(() => {
  mockStateQueue.splice(0, mockStateQueue.length);

  setWorkspaceApiClientFactoryForTests(() => ({} as never));
  setUseAsyncStateImplementationForTests(() => {
    const next = mockStateQueue.shift();
    if (next === undefined) {
      throw new Error('Missing mocked async state');
    }
    return next as never;
  });
});

afterEach(() => {
  resetWorkspaceApiClientFactoryForTests();
  resetUseAsyncStateImplementationForTests();
});

function renderWorkspacePage(element: ReactElement, states: readonly unknown[]): string {
  mockStateQueue.splice(
    0,
    mockStateQueue.length,
    ...states.map((data) => ({
      status: 'ready',
      data,
    }) satisfies ReadyAsyncState),
  );
  return renderToStaticMarkup(
    createElement(
      VestaraThemeProvider,
      null,
      createElement(MemoryRouter, { initialEntries: ['/workspace/overview'] }, element),
    ),
  );
}

describe('workspace page smoke renders', () => {
  it('renders the components page', () => {
    const components = [
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
    ] as unknown as readonly ComponentView[];
    const categories = [{ name: 'controls', count: 1 }] as readonly ComponentCategoryView[];

    const html = renderWorkspacePage(createElement(ComponentsPage), [components, categories]);

    expect(html).toContain('Components');
    expect(html).toContain('Button');
    expect(html).toContain('controls');
  });

  it('renders the templates page', () => {
    const templates = [
      {
        id: 'template.system',
        name: 'system',
        version: '1.0.0',
        kind: 'layout',
        tags: ['admin', 'system'],
        parameters: [{ name: 'title', type: 'string', required: true, defaultValue: 'Vestara' }],
        recommendedThemeId: 'theme.dark',
        requiredCapabilities: ['templates', 'themes'],
        metadata: { author: 'Vestara', version: '1.0.0', license: 'MIT', tags: ['shell'] },
      },
    ] as unknown as readonly TemplateView[];
    const kinds = ['layout', 'page'] as readonly string[];

    const html = renderWorkspacePage(createElement(TemplatesPage), [templates, kinds]);

    expect(html).toContain('Templates');
    expect(html).toContain('template.system');
    expect(html).toContain('theme.dark');
  });

  it('renders the pages page', () => {
    const pages = [
      {
        id: 'page.dashboard',
        name: 'dashboard',
        route: '/dashboard',
        layout: { type: 'grid', content: {} },
        nodes: [{ id: 'node-1' }],
        dataSources: [{ id: 'api-1' }],
        actions: [{ id: 'refresh' }],
        permissions: [{ id: 'view' }],
        responsive: [{ breakpoint: 'lg' }],
        metadata: { title: 'Dashboard', authRequired: true },
        revision: 3,
        updatedAt: '2026-08-17T00:00:00.000Z',
      },
    ] as unknown as readonly PageDefinitionView[];

    const html = renderWorkspacePage(createElement(PagesPage), [pages]);

    expect(html).toContain('Pages');
    expect(html).toContain('page.dashboard');
    expect(html).toContain('/dashboard');
  });

  it('renders the dashboards page', () => {
    const dashboards = [
      {
        id: 'dashboard.system',
        name: 'System',
        scope: 'platform',
        layout: { columns: 12, rowHeight: 24, gap: 16, placements: [{ widgetId: 'w1' }] },
        widgets: [
          {
            id: 'w1',
            type: 'health',
            title: 'Health',
            configuration: {},
            placement: { x: 0, y: 0, width: 6, height: 4, breakpoint: 'lg' },
            state: 'ready',
          },
        ],
        filters: [],
        refreshPolicy: { mode: 'interval', intervalSeconds: 60 },
        revision: 2,
        createdAt: '2026-08-15T00:00:00.000Z',
        updatedAt: '2026-08-17T00:00:00.000Z',
        publishedAt: '2026-08-17T00:00:00.000Z',
      },
    ] as unknown as readonly DashboardView[];

    const html = renderWorkspacePage(createElement(DashboardsPage), [dashboards]);

    expect(html).toContain('Dashboards');
    expect(html).toContain('dashboard.system');
    expect(html).toContain('Health');
  });

  it('renders the applications page', () => {
    const applications = [
      {
        id: 'app.admin',
        name: 'Admin',
        version: '1.0.0',
        applicationType: 'control-plane',
        pages: [{ pageId: 'page.dashboard', path: '/dashboard', default: true }],
        routes: [{ path: '/dashboard', pageId: 'page.dashboard', authRequired: true }],
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
    ] as unknown as readonly ApplicationView[];

    const html = renderWorkspacePage(createElement(ApplicationsPage), [applications]);

    expect(html).toContain('Applications');
    expect(html).toContain('app.admin');
    expect(html).toContain('integration.logs');
  });

  it('renders the generator page', () => {
    const generators = [
      { id: 'generator.react', version: '1.0.0', capabilities: ['react', 'docs'], requiresSecrets: false },
    ] as unknown as readonly GeneratorDescriptorView[];
    const capabilities = ['react', 'docs'] as readonly string[];

    const html = renderWorkspacePage(createElement(GeneratorPage), [generators, capabilities]);

    expect(html).toContain('Generator');
    expect(html).toContain('generator.react');
    expect(html).toContain('react');
  });

  it('renders the themes page', () => {
    const themes = [
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
    ] as unknown as readonly ThemeView[];

    const html = renderWorkspacePage(createElement(ThemesPage), [themes]);

    expect(html).toContain('Themes');
    expect(html).toContain('theme.dark');
    expect(html).toContain('#B89B5E');
  });

  it('renders the files page', () => {
    const workspaces = [
      { id: 'ws-1', name: 'Workspace 1', root: '/workspace', providerId: 'local', include: ['src'], exclude: ['dist'], revision: 3 },
    ] as unknown as readonly FileWorkspaceView[];
    const events = [{ type: 'apply', at: '2026-08-17T00:00:00.000Z', workspaceId: 'ws-1', path: '/workspace/src/main.ts' }] as readonly FileEventView[];

    const html = renderWorkspacePage(createElement(FilesPage), [workspaces, events]);

    expect(html).toContain('Files');
    expect(html).toContain('ws-1');
    expect(html).toContain('apply');
  });

  it('renders the configuration page', () => {
    const schemas = [
      { namespace: 'workspace', version: '1.0.0', scope: ['workspace'], secretFields: ['api.token'] },
    ] as unknown as readonly ConfigSchemaView[];
    const fields = [
      { key: 'api.token', title: 'API Token', type: 'string', required: true, secret: true, reloadBehavior: 'restart', risk: 'critical' },
    ] as unknown as readonly ConfigFieldView[];
    const contributions = [
      { packageId: 'pkg.workspace', namespace: 'workspace', version: '1.0.0', fields },
    ] as unknown as readonly ConfigContributionView[];
    const resolved = [
      { key: 'api.token', value: 'secret', scope: 'workspace', source: 'workspace', secret: true },
    ] as unknown as readonly ResolvedConfigValueView[];

    const html = renderWorkspacePage(createElement(ConfigurationPage), [schemas, fields, contributions, resolved]);

    expect(html).toContain('Configuration');
    expect(html).toContain('workspace');
    expect(html).toContain('api.token');
  });
});
