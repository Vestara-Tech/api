import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Box, Card, CardActionArea, CardContent, Chip, Stack, Typography } from '@mui/material';
import { agentBuilderApi, type AgentView } from '../api/agentBuilderApi';

export function AgentsPage() {
  const [agents, setAgents] = useState<readonly AgentView[]>([]);

  useEffect(() => {
    void agentBuilderApi.agents().then(setAgents).catch(() => undefined);
  }, []);

  return (
    <Box sx={{ p: 3, maxWidth: 900 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Agents
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Vestara agents are identity + role + policies + runtime. Skills, tools,
        models and runtimes are reusable registry-backed selectors, not hardcoded UI options.
      </Typography>

      <Stack spacing={1}>
        {agents.map((agent) => (
          <Card key={agent.id} variant="outlined">
            <CardActionArea component={Link} to={`/agent-builder/${agent.id}`}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                  <Typography sx={{ fontWeight: 600 }}>{agent.name}</Typography>
                  <Chip size="small" label={agent.role} variant="outlined" />
                  <Chip size="small" label={`${agent.tools.length} tools`} />
                  <Chip size="small" label={`${agent.skills.length} skills`} />
                  <Chip size="small" label={`${agent.permissions.length} permissions`} />
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
        {agents.length === 0 ? <Typography variant="body2" sx={{ color: 'text.secondary' }}>No agents loaded.</Typography> : null}
      </Stack>
    </Box>
  );
}
