import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { MarketplaceLayout } from '../layouts/MarketplaceLayout';
import { DiscoverPage } from '../pages/DiscoverPage';
import { PackageDetailsPage } from '../pages/PackageDetailsPage';
import { InstalledPage } from '../pages/InstalledPage';
import { MyLibraryPage } from '../pages/MyLibraryPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MarketplaceLayout />}>
          <Route path="/" element={<Navigate to="/marketplace" replace />} />
          <Route path="/marketplace" element={<DiscoverPage />} />
          <Route path="/marketplace/installed" element={<InstalledPage />} />
          <Route path="/marketplace/library" element={<MyLibraryPage />} />
          <Route path="/marketplace/packages/:packageId" element={<PackageDetailsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/marketplace" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
