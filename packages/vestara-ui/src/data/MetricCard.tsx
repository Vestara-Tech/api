import type { ReactNode } from 'react';
import { Card, CardContent, Paper, Stack, Typography, type SxProps, type Theme } from '@mui/material';

import { StatusBadge } from '../feedback/StatusBadge.js';
import type { StatusTone } from '../feedback/StatusDot.js';
import { mergeSx } from '../utils/mergeSx.js';

export type MetricCardLayout = 'summary' | 'badge';

export interface MetricCardProps {
  readonly label: ReactNode;
  readonly value: ReactNode;
  readonly detail?: ReactNode;
  readonly tone?: StatusTone;
  readonly variant?: MetricCardLayout;
  readonly sx?: SxProps<Theme>;
}

export function MetricCard({
  label,
  value,
  detail,
  tone = 'neutral',
  variant = 'summary',
  sx,
}: MetricCardProps) {
  if (variant === 'badge') {
    return (
      <Card variant="outlined" sx={sx}>
        <CardContent>
          <Stack spacing={1}>
            <StatusBadge label={label} tone={tone} sx={{ alignSelf: 'flex-start' }} />
            <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
              {value}
            </Typography>
            {detail !== undefined ? (
              <Typography variant="body2" color="text.secondary">
                {detail}
              </Typography>
            ) : null}
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Paper variant="outlined" sx={mergeSx({ p: 2, minHeight: 116 }, sx)}>
      <Stack spacing={0.75}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
          {label}
        </Typography>
        <Typography variant="h4" sx={{ lineHeight: 1.1, fontWeight: 700 }}>
          {value}
        </Typography>
        {detail !== undefined ? (
          <Typography variant="body2" color="text.secondary">
            {detail}
          </Typography>
        ) : null}
      </Stack>
    </Paper>
  );
}
