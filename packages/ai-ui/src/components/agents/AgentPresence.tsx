import { Box, Chip, Stack, Typography } from '@mui/material';

export interface AgentPresenceProps {
  readonly agentId: string;
  readonly agentName: string;
  readonly status: 'idle' | 'running' | 'waiting' | 'completed' | 'failed';
  readonly detail?: string;
}

/** AgentPresence — a compact agent status chip used by Activity Room. */
export function AgentPresence({ agentId, agentName, status, detail }: AgentPresenceProps) {
  const color = status === 'running' ? 'info' : status === 'completed' ? 'success' : status === 'failed' ? 'error' : status === 'waiting' ? 'warning' : 'default';
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', px: 1.5, py: 1 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Chip size="small" label={agentName} color={color} variant="outlined" />
        <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>{agentId}</Typography>
        <Chip size="small" label={status} color={color} />
      </Stack>
      {detail ? <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>{detail}</Typography> : null}
    </Box>
  );
}
