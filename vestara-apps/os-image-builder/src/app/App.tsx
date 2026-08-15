import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { ImageBuilderLayout } from '../layouts/ImageBuilderLayout';
import { ProfilesPage } from '../pages/ProfilesPage';
import { OverviewPage } from '../pages/OverviewPage';
import { BaseSystemPage } from '../pages/BaseSystemPage';
import { PackagesPage } from '../pages/PackagesPage';
import { BootPage } from '../pages/BootPage';
import { StartupPage } from '../pages/StartupPage';
import { LoginPage } from '../pages/LoginPage';
import { DesktopPage } from '../pages/DesktopPage';
import { ApplicationsPage } from '../pages/ApplicationsPage';
import { SecurityPage } from '../pages/SecurityPage';
import { RecoveryPage } from '../pages/RecoveryPage';
import { ConfigurationPage } from '../pages/ConfigurationPage';
import { BuildPage } from '../pages/BuildPage';
import { ImageBuilderRoute } from '../routes/ImageBuilderRoute';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<ImageBuilderLayout />}>
          <Route path="/" element={<Navigate to="/os-image-builder" replace />} />
          <Route path="/os-image-builder" element={<ProfilesPage />} />

          <Route path="/os-image-builder/:profileId" element={<ImageBuilderRoute><OverviewPage /></ImageBuilderRoute>} />
          <Route path="/os-image-builder/:profileId/base" element={<ImageBuilderRoute><BaseSystemPage /></ImageBuilderRoute>} />
          <Route path="/os-image-builder/:profileId/packages" element={<ImageBuilderRoute><PackagesPage /></ImageBuilderRoute>} />
          <Route path="/os-image-builder/:profileId/boot" element={<ImageBuilderRoute><BootPage /></ImageBuilderRoute>} />
          <Route path="/os-image-builder/:profileId/startup" element={<ImageBuilderRoute><StartupPage /></ImageBuilderRoute>} />
          <Route path="/os-image-builder/:profileId/login" element={<ImageBuilderRoute><LoginPage /></ImageBuilderRoute>} />
          <Route path="/os-image-builder/:profileId/desktop" element={<ImageBuilderRoute><DesktopPage /></ImageBuilderRoute>} />
          <Route path="/os-image-builder/:profileId/apps" element={<ImageBuilderRoute><ApplicationsPage /></ImageBuilderRoute>} />
          <Route path="/os-image-builder/:profileId/security" element={<ImageBuilderRoute><SecurityPage /></ImageBuilderRoute>} />
          <Route path="/os-image-builder/:profileId/recovery" element={<ImageBuilderRoute><RecoveryPage /></ImageBuilderRoute>} />
          <Route path="/os-image-builder/:profileId/configuration" element={<ImageBuilderRoute><ConfigurationPage /></ImageBuilderRoute>} />
          <Route path="/os-image-builder/:profileId/build" element={<ImageBuilderRoute><BuildPage /></ImageBuilderRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/os-image-builder" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
