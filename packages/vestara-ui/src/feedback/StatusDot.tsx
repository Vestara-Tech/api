import { Box, type SxProps, type Theme } from '@mui/material';

import { mergeSx } from '../utils/mergeSx.js';

export type StatusTone = 'healthy' | 'warning' | 'critical' | 'info' | 'neutral';

export interface StatusDotProps {
  readonly tone?: StatusTone;
  readonly size?: number;
  readonly sx?: SxProps<Theme>;
}

const toneColors: Record<StatusTone, string> = {
  healthy: 'success.main',
  warning: 'warning.main',
  critical: 'error.main',
  info: 'info.main',
  neutral: 'text.disabled',
};

export function StatusDot({ tone = 'neutral', size = 8, sx }: StatusDotProps) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={mergeSx(
        {
          display: 'inline-block',
          width: size,
          height: size,
          borderRadius: '999px',
          bgcolor: toneColors[tone],
          boxShadow: tone === 'neutral' ? 'none' : '0 0 0 3px rgba(255,255,255,0.04)',
        },
        sx,
      )}
    />
  );
}
