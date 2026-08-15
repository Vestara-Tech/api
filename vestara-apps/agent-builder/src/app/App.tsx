import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AgentBuilderLayout } from '../layouts/AgentBuilderLayout';
import { AgentsPage } from '../pages/AgentsPage';
import { AgentBuilderPage } from '../pages/AgentBuilderPage';
import { TestAgentPage } from '../pages/TestAgentPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AgentBuilderLayout />}>
          <Route path="/" element={<Navigate to="/agent-builder" replace />} />
          <Route path="/agent-builder" element={<AgentsPage />} />
          <Route path="/agent-builder/:agentId" element={<AgentBuilderPage />} />
          <Route path="/agent-builder/:agentId/test" element={<TestAgentPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/agent-builder" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
