import { Alert, Button, Stack, Typography } from '@mui/material';
import type { ApiConnectionState, ApiNegotiationResult } from '@vestara/client';

export function ConnectionBanner({
  state,
  apiBase,
  contract,
  onRetry,
  onDiagnostics,
}: {
  state: ApiConnectionState;
  apiBase: string;
  contract?: ApiNegotiationResult['contract'];
  onRetry: () => void;
  onDiagnostics?: () => void;
}) {
  if (state.status === 'unknown' || state.status === 'online') return null;

  const isMismatch = state.status === 'contract-mismatch';
  const severity = state.status === 'offline' || isMismatch ? 'error' : 'warning';
  const title = state.status === 'offline'
    ? 'Vestara API unavailable'
    : isMismatch
      ? 'API contract mismatch'
      : 'Vestara API degraded';

  return (
    <Alert severity={severity} sx={{ borderRadius: 0 }} action={
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        {onDiagnostics ? (
          <Button color="inherit" size="small" onClick={onDiagnostics}>
            Diagnostics
          </Button>
        ) : null}
        <Button color="inherit" size="small" onClick={onRetry}>
          Retry
        </Button>
      </Stack>
    }>
      <Stack spacing={0.25}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{title}</Typography>
        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
          {isMismatch && contract
            ? `Client expects ${contract.expected}, API serves ${contract.actual ?? 'unknown'}`
            : `Unable to connect to ${apiBase}`}
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
