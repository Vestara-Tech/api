import { describe, expect, it } from 'vitest';

import { resolveWorkspaceRouteElement } from '../src/app/navigation/routes.js';
import { ApplicationsPage } from '../src/pages/ApplicationsPage.js';
import { ComponentsPage } from '../src/pages/ComponentsPage.js';
import { ConfigurationPage } from '../src/pages/ConfigurationPage.js';
import { DashboardsPage } from '../src/pages/DashboardsPage.js';
import { FilesPage } from '../src/pages/FilesPage.js';
import { GeneratorPage } from '../src/pages/GeneratorPage.js';
import { NotFoundPage } from '../src/pages/NotFoundPage.js';
import { OverviewPage } from '../src/pages/OverviewPage.js';
import { PagesPage } from '../src/pages/PagesPage.js';
import { TemplatesPage } from '../src/pages/TemplatesPage.js';
import { ThemesPage } from '../src/pages/ThemesPage.js';

describe('workspace route resolution', () => {
  it('maps authored paths to the expected page components', () => {
    expect(resolveWorkspaceRouteElement('overview').type).toBe(OverviewPage);
    expect(resolveWorkspaceRouteElement('components').type).toBe(ComponentsPage);
    expect(resolveWorkspaceRouteElement('templates').type).toBe(TemplatesPage);
    expect(resolveWorkspaceRouteElement('pages').type).toBe(PagesPage);
    expect(resolveWorkspaceRouteElement('dashboards').type).toBe(DashboardsPage);
    expect(resolveWorkspaceRouteElement('applications').type).toBe(ApplicationsPage);
    expect(resolveWorkspaceRouteElement('generator').type).toBe(GeneratorPage);
    expect(resolveWorkspaceRouteElement('themes').type).toBe(ThemesPage);
    expect(resolveWorkspaceRouteElement('files').type).toBe(FilesPage);
    expect(resolveWorkspaceRouteElement('configuration').type).toBe(ConfigurationPage);
  });

  it('falls back to the not-found page for unknown paths', () => {
    expect(resolveWorkspaceRouteElement('unknown').type).toBe(NotFoundPage);
  });
});
