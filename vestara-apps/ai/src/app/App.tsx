import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AiLayout } from '../layouts/AiLayout';
import { ActivityRoomPage } from '../pages/ActivityRoomPage';
import { AiChatPage } from '../pages/AiChatPage';
import { AgentWorkspacePage } from '../pages/AgentWorkspacePage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AiLayout />}>
          <Route path="/" element={<Navigate to="/ai/activity" replace />} />
          <Route path="/ai/activity" element={<ActivityRoomPage />} />
          <Route path="/ai/chat" element={<AiChatPage />} />
          <Route path="/ai/agents" element={<AgentWorkspacePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/ai/activity" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
