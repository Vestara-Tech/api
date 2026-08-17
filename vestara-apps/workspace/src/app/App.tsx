import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { VestaraThemeProvider } from '@vestara/ui';

import { CapabilityNavigationProvider } from './navigation/CapabilityNavigationProvider.js';
import { WorkspaceLayout } from './layout/WorkspaceLayout.js';
import { OverviewPage } from '../pages/OverviewPage.js';
import { NotFoundPage } from '../pages/NotFoundPage.js';
import { WORKSPACE_NAVIGATION } from './navigation/navigation.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { resolveWorkspaceRouteElement } from './navigation/routes.js';

export function App() {
  return (
    <VestaraThemeProvider>
      <CapabilityNavigationProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/workspace/overview" replace />} />
              <Route path="/workspace" element={<WorkspaceLayout />}>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<OverviewPage />} />
                {WORKSPACE_NAVIGATION.filter((group) => group.id !== 'overview').flatMap((group) =>
                  group.items.map((item) => (
                    <Route
                      key={item.id}
                      path={item.path}
                      element={resolveWorkspaceRouteElement(item.path)}
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
