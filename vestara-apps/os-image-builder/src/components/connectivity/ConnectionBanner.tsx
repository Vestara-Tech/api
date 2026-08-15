import { Alert, Button, Stack, Typography } from '@mui/material';
import type { ApiConnectionState } from '@vestara/client';

export function ConnectionBanner({ state, apiBase, onRetry }: { state: ApiConnectionState; apiBase: string; onRetry: () => void }) {
  if (state.status === 'unknown' || state.status === 'online') return null;

  const severity = state.status === 'offline' ? 'error' : 'warning';
  const title = state.status === 'offline' ? 'Vestara API unavailable' : 'Vestara API degraded';

  return (
    <Alert severity={severity} sx={{ borderRadius: 0 }} action={
      <Button color="inherit" size="small" onClick={onRetry}>
        Retry
      </Button>
    }>
      <Stack spacing={0.25}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{title}</Typography>
        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
          Unable to connect to {apiBase}
        </Typography>
        {state.message ? (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{state.message}</Typography>
        ) : null}
        {state.lastAttemptAt ? (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Last attempt {new Date(state.lastAttemptAt).toLocaleTimeString()}
          </Typography>
        ) : null}
      </Stack>
    </Alert>
  );
}
