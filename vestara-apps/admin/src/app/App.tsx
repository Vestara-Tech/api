import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { VestaraThemeProvider } from '@vestara/ui';

import { CapabilityNavigationProvider } from './navigation/CapabilityNavigationProvider.js';
import { AdminLayout } from './layout/AdminLayout.js';
import { DashboardPage } from '../pages/DashboardPage.js';
import { ActivityPage } from '../pages/ActivityPage.js';
import { NotificationsPage } from '../pages/NotificationsPage.js';
import { SystemPage } from '../pages/SystemPage.js';
import { OsPage } from '../pages/OsPage.js';
import { AIPage } from '../pages/AIPage.js';
import { AgentsPage } from '../pages/AgentsPage.js';
import { WorkflowsPage } from '../pages/WorkflowsPage.js';
import { TasksPage } from '../pages/TasksPage.js';
import { PagesPage } from '../pages/PagesPage.js';
import { DashboardsPage } from '../pages/DashboardsPage.js';
import { ApplicationsPage } from '../pages/ApplicationsPage.js';
import { TemplatesPage } from '../pages/TemplatesPage.js';
import { DatabasePage } from '../pages/DatabasePage.js';
import { FilesPage } from '../pages/FilesPage.js';
import { ContextPage } from '../pages/ContextPage.js';
import { BuildersPage } from '../pages/BuildersPage.js';
import { GeneratorPage } from '../pages/GeneratorPage.js';
import { ComponentsPage } from '../pages/ComponentsPage.js';
import { ConfigurationPage } from '../pages/ConfigurationPage.js';
import { MarketplacePage } from '../pages/MarketplacePage.js';
import { ModulesPage } from '../pages/ModulesPage.js';
import { UsersPage } from '../pages/UsersPage.js';
import { PermissionsPage } from '../pages/PermissionsPage.js';
import { AuthenticationPage } from '../pages/AuthenticationPage.js';
import { SettingsPage } from '../pages/SettingsPage.js';
import { SecurityPage } from '../pages/SecurityPage.js';
import { AboutPage } from '../pages/AboutPage.js';
import { ThemesPage } from '../pages/ThemesPage.js';
import { DiagnosticsPage } from '../pages/DiagnosticsPage.js';
import { EvidencePage } from '../pages/EvidencePage.js';
import { LogsPage } from '../pages/LogsPage.js';
import { IntegrationsPage } from '../pages/IntegrationsPage.js';
import { SectionPage } from '../pages/SectionPage.js';
import { NotFoundPage } from '../pages/NotFoundPage.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { ADMIN_NAVIGATION } from './navigation/navigation.js';

function sectionElement(title: string, description: string, parent: string) {
  return <SectionPage title={title} description={description} breadcrumbs={[{ label: 'Admin', href: '/admin/dashboard' }, { label: parent }, { label: title }]} />;
}

function routeElement(path: string, title: string, description: string, parent: string) {
  switch (path) {
    case 'dashboard':
      return <DashboardPage />;
    case 'activity':
      return <ActivityPage />;
    case 'notifications':
      return <NotificationsPage />;
    case 'system':
      return <SystemPage />;
    case 'os':
      return <OsPage />;
    case 'ai':
      return <AIPage />;
    case 'agents':
      return <AgentsPage />;
    case 'workflows':
      return <WorkflowsPage />;
    case 'tasks':
      return <TasksPage />;
    case 'pages':
      return <PagesPage />;
    case 'dashboards':
      return <DashboardsPage />;
    case 'applications':
      return <ApplicationsPage />;
    case 'templates':
      return <TemplatesPage />;
    case 'database':
      return <DatabasePage />;
    case 'files':
      return <FilesPage />;
    case 'context':
      return <ContextPage />;
    case 'builders':
      return <BuildersPage />;
    case 'generator':
      return <GeneratorPage />;
    case 'components':
      return <ComponentsPage />;
    case 'configuration':
      return <ConfigurationPage />;
    case 'marketplace':
      return <MarketplacePage />;
    case 'modules':
      return <ModulesPage />;
    case 'integrations':
      return <IntegrationsPage />;
    case 'users':
      return <UsersPage />;
    case 'permissions':
      return <PermissionsPage />;
    case 'authentication':
      return <AuthenticationPage />;
    case 'settings':
      return <SettingsPage />;
    case 'themes':
      return <ThemesPage />;
    case 'security':
      return <SecurityPage />;
    case 'about':
      return <AboutPage />;
    case 'diagnostics':
      return <DiagnosticsPage />;
    case 'logs':
      return <LogsPage />;
    case 'evidence':
      return <EvidencePage />;
    default:
      return sectionElement(title, description, parent);
  }
}

export function App() {
  return (
    <VestaraThemeProvider>
      <CapabilityNavigationProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="activity" element={<ActivityPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                {ADMIN_NAVIGATION.filter((group) => group.id !== 'overview').flatMap((group) =>
                  group.items.map((item) => (
                    <Route
                      key={item.id}
                      path={item.path}
                      element={routeElement(item.path, item.label, item.description, group.label)}
                    />
                  )),
                )}
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </ErrorBoundary>
      </CapabilityNavigationProvider>
    </VestaraThemeProvider>
  );
}
