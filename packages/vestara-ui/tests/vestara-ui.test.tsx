import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  AppHeader,
  AppShell,
  AppSidebar,
  KeyValueList,
  LoadableCard,
  MetricCard,
  PageBreadcrumbs,
  PageContainer,
  StatusBadge,
  buildThemeEndpoint,
  fallbackThemeDefinition,
} from '../src/index.js';

describe('@vestara/ui theme', () => {
  it('uses the backend gold brand token in the fallback theme', () => {
    expect(fallbackThemeDefinition.tokens['color.brand.primary']).toBe('#B89B5E');
  });

  it('builds the theme API endpoint from the configured base URL', () => {
    expect(buildThemeEndpoint('/api', 'vestara.dark')).toBe('/api/v2/themes/vestara.dark/mui');
    expect(buildThemeEndpoint('http://localhost:4310/api/', 'vestara.dark')).toBe('http://localhost:4310/api/v2/themes/vestara.dark/mui');
  });
});

describe('@vestara/ui shell primitives', () => {
  it('renders the shell layout', () => {
    const html = renderToStaticMarkup(
      <AppShell
        header={<AppHeader appName="Vestara" />}
        sidebar={<AppSidebar title="Navigation">Sidebar</AppSidebar>}
      >
        <PageContainer title="Dashboard">Main content</PageContainer>
      </AppShell>,
    );

    expect(html).toContain('Vestara');
    expect(html).toContain('Sidebar');
    expect(html).toContain('Dashboard');
    expect(html).toContain('Main content');
  });

  it('renders a status badge', () => {
    const html = renderToStaticMarkup(<StatusBadge label="Healthy" tone="healthy" />);
    expect(html).toContain('Healthy');
  });
});

describe('@vestara/ui content primitives', () => {
  it('renders breadcrumbs', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PageBreadcrumbs
          gutterBottom
          items={[
            { label: 'Workspace', href: '/workspace' },
            { label: 'Components' },
          ]}
        />
      </MemoryRouter>,
    );

    expect(html).toContain('Workspace');
    expect(html).toContain('Components');
  });

  it('renders metric cards in summary and badge modes', () => {
    const html = renderToStaticMarkup(
      <>
        <MetricCard label="Items" value="12" detail="Tracked entries" />
        <MetricCard label="Health" value="Ready" detail="All systems green" tone="healthy" variant="badge" />
      </>,
    );

    expect(html).toContain('Items');
    expect(html).toContain('12');
    expect(html).toContain('Health');
    expect(html).toContain('Ready');
  });

  it('renders key value lists in stacked mode', () => {
    const html = renderToStaticMarkup(
      <KeyValueList
        items={[
          { label: 'Scope', value: 'workspace' },
          { label: 'Version', value: '1.0.0' },
        ]}
      />,
    );

    expect(html).toContain('Scope');
    expect(html).toContain('workspace');
    expect(html).toContain('Version');
  });

  it('renders loadable cards', () => {
    const html = renderToStaticMarkup(
      <LoadableCard
        title="Status"
        description="Loadable content"
        state={{ status: 'ready', data: 'Done' }}
        renderContent={(value) => value}
      />,
    );

    expect(html).toContain('Status');
    expect(html).toContain('Done');
  });
});
