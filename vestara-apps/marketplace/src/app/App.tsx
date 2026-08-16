import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { MarketplaceLayout } from '../layouts/MarketplaceLayout';
import { DiscoverPage } from '../pages/DiscoverPage';
import { CategoriesPage } from '../pages/CategoriesPage';
import { PackageDetailsPage } from '../pages/PackageDetailsPage';
import { InstalledPage } from '../pages/InstalledPage';
import { MyLibraryPage } from '../pages/MyLibraryPage';
import { CollectionsPage } from '../pages/CollectionsPage';
import { BundlesPage } from '../pages/BundlesPage';
import { InstallReviewPage } from '../pages/InstallReviewPage';
import { UpdatesPage } from '../pages/UpdatesPage';
import { PackageBuilderPage } from '../pages/PackageBuilderPage';
import { PublisherConsolePage } from '../pages/PublisherConsolePage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MarketplaceLayout />}>
          <Route path="/" element={<Navigate to="/marketplace" replace />} />
          <Route path="/marketplace" element={<DiscoverPage />} />
          <Route path="/marketplace/categories" element={<CategoriesPage />} />
          <Route path="/marketplace/installed" element={<InstalledPage />} />
          <Route path="/marketplace/library" element={<MyLibraryPage />} />
          <Route path="/marketplace/collections" element={<CollectionsPage />} />
          <Route path="/marketplace/bundles" element={<BundlesPage />} />
          <Route path="/marketplace/install-review/:distributionId" element={<InstallReviewPage />} />
          <Route path="/marketplace/updates" element={<UpdatesPage />} />
          <Route path="/marketplace/packages/:packageId" element={<PackageDetailsPage />} />
          <Route path="/marketplace/publisher-console" element={<PublisherConsolePage />} />
          <Route path="/marketplace/package-builder" element={<PackageBuilderPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/marketplace" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
