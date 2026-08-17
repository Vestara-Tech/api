import type { ReactElement } from 'react';

import { ApplicationsPage } from '../../pages/ApplicationsPage.js';
import { ComponentsPage } from '../../pages/ComponentsPage.js';
import { ConfigurationPage } from '../../pages/ConfigurationPage.js';
import { DashboardsPage } from '../../pages/DashboardsPage.js';
import { FilesPage } from '../../pages/FilesPage.js';
import { GeneratorPage } from '../../pages/GeneratorPage.js';
import { NotFoundPage } from '../../pages/NotFoundPage.js';
import { OverviewPage } from '../../pages/OverviewPage.js';
import { PagesPage } from '../../pages/PagesPage.js';
import { TemplatesPage } from '../../pages/TemplatesPage.js';
import { ThemesPage } from '../../pages/ThemesPage.js';

export function resolveWorkspaceRouteElement(path: string): ReactElement {
  switch (path) {
    case 'overview':
      return <OverviewPage />;
    case 'components':
      return <ComponentsPage />;
    case 'templates':
      return <TemplatesPage />;
    case 'pages':
      return <PagesPage />;
    case 'dashboards':
      return <DashboardsPage />;
    case 'applications':
      return <ApplicationsPage />;
    case 'generator':
      return <GeneratorPage />;
    case 'themes':
      return <ThemesPage />;
    case 'files':
      return <FilesPage />;
    case 'configuration':
      return <ConfigurationPage />;
    default:
      return <NotFoundPage />;
  }
}
