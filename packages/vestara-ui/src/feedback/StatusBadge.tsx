import type { ReactNode } from 'react';
import { Chip, type ChipProps } from '@mui/material';

import { StatusDot, type StatusTone } from './StatusDot.js';
import { mergeSx } from '../utils/mergeSx.js';

export interface StatusBadgeProps extends Omit<ChipProps, 'label' | 'color' | 'variant'> {
  readonly label: ReactNode;
  readonly tone?: StatusTone;
}

export function StatusBadge({ label, tone = 'neutral', sx, ...props }: StatusBadgeProps) {
  return (
    <Chip
      {...props}
      size={props.size ?? 'small'}
      variant="outlined"
      icon={<StatusDot tone={tone} size={7} />}
      label={label}
      sx={mergeSx(
        {
          borderColor: 'divider',
          bgcolor: 'background.paper',
          '& .MuiChip-icon': { ml: 0.75 },
        },
        sx,
      )}
    />
  );
}
