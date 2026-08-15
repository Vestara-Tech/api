import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { BuilderLayout } from '../layouts/BuilderLayout';
import { DefinitionsPage } from '../pages/DefinitionsPage';
import { BuilderPage } from '../pages/BuilderPage';
import { EndpointPage } from '../pages/EndpointPage';
import { PreviewPage } from '../pages/PreviewPage';
import { RevisionsPage } from '../pages/RevisionsPage';
import { DefinitionRoute } from '../routes/DefinitionRoute';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<BuilderLayout />}>
          <Route path="/" element={<Navigate to="/definitions" replace />} />
          <Route path="/definitions" element={<DefinitionsPage />} />

          <Route path="/definitions/:definitionId" element={<DefinitionRoute><BuilderPage /></DefinitionRoute>} />
          <Route
            path="/definitions/:definitionId/endpoints/:endpointId"
            element={<DefinitionRoute><EndpointPage /></DefinitionRoute>}
          />
          <Route
            path="/definitions/:definitionId/preview"
            element={<DefinitionRoute><PreviewPage /></DefinitionRoute>}
          />
          <Route
            path="/definitions/:definitionId/revisions"
            element={<DefinitionRoute><RevisionsPage /></DefinitionRoute>}
          />
        </Route>
        <Route path="*" element={<Navigate to="/definitions" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
