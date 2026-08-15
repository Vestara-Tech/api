import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useBuilder } from '../context/BuilderContext';
import { DefinitionNavigator } from '../components/navigator/DefinitionNavigator';
import { ResourceCanvas } from '../components/canvas/ResourceCanvas';
import { Inspector } from '../components/inspector/Inspector';
import { ActionHeader } from '../components/header/ActionHeader';
import { AssistantPanel } from '../components/assistant/AssistantPanel';

export function BuilderPage() {
  const { definition, selectedResource } = useBuilder();
  const [assistantOpen, setAssistantOpen] = useState(false);

  if (!definition) {
    return (
      <Box sx={{ p: 4, color: 'text.secondary' }}>
        <Typography>Loading definition…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ActionHeader definition={definition} onToggleAssistant={() => setAssistantOpen((v) => !v)} assistantOpen={assistantOpen} />
      <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: `260px 1fr 320px${assistantOpen ? ' 360px' : ''}`, minHeight: 0 }}>
        <DefinitionNavigator />
        <ResourceCanvas resource={selectedResource} />
        <Inspector />
        {assistantOpen ? <AssistantPanel /> : null}
      </Box>
    </Box>
  );
}
