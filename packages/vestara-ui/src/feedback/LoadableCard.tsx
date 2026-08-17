import type { ReactNode } from 'react';
import { Alert, Box, Card, CardContent, Divider, Skeleton, Stack, Typography, type SxProps, type Theme } from '@mui/material';

import { StatusBadge } from './StatusBadge.js';
import type { StatusTone } from './StatusDot.js';

export interface LoadableState<T> {
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
  readonly data?: T | undefined;
  readonly error?: string | undefined;
}

export interface LoadableCardProps<T> {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly state: LoadableState<T>;
  readonly actions?: ReactNode;
  readonly loadingLabel?: ReactNode;
  readonly renderContent: (data: T) => ReactNode;
  readonly tone?: StatusTone;
  readonly sx?: SxProps<Theme>;
}

function toneForState(status: LoadableState<unknown>['status'], fallback: StatusTone): StatusTone {
  if (status === 'idle' || status === 'loading') return 'info';
  if (status === 'error') return 'warning';
  return fallback;
}

export function LoadableCard<T>({
  title,
  description,
  state,
  actions,
  loadingLabel = 'Loading',
  renderContent,
  tone = 'neutral',
  sx,
}: LoadableCardProps<T>) {
  return (
    <Card variant="outlined" sx={sx}>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                {title}
              </Typography>
              {description !== undefined ? (
                <Typography variant="body2" color="text.secondary">
                  {description}
                </Typography>
              ) : null}
            </Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0 }}>
              <StatusBadge
                label={state.status === 'ready' ? 'Ready' : state.status === 'error' ? 'Error' : loadingLabel}
                tone={toneForState(state.status, tone)}
              />
              {actions}
            </Stack>
          </Stack>

          <Divider />

          {state.status === 'idle' || state.status === 'loading' ? (
            <Stack spacing={1}>
              <Skeleton variant="rounded" height={28} />
              <Skeleton variant="rounded" height={18} />
              <Skeleton variant="rounded" height={18} />
            </Stack>
          ) : state.status === 'error' ? (
            <Alert severity="warning">{state.error ?? 'Unable to load data.'}</Alert>
          ) : state.data === undefined ? (
            <Alert severity="info">No data available.</Alert>
          ) : (
            renderContent(state.data)
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
