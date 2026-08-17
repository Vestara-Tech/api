import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';

import type { NavigationItemDefinition } from './NavigationItem.js';

export interface NavigationGroupDefinition {
  readonly id: string;
  readonly label: ReactNode;
  readonly items: readonly NavigationItemDefinition[];
}

export interface NavigationGroupProps {
  readonly label: ReactNode;
  readonly compact?: boolean;
  readonly children: ReactNode;
}

export function NavigationGroup({ label, compact = false, children }: NavigationGroupProps) {
  return (
    <Box sx={{ px: compact ? 0.5 : 1.25, py: compact ? 0.5 : 1 }}>
      {compact ? null : (
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ display: 'block', px: 1, letterSpacing: 1.1, mb: 0.5 }}
        >
          {label}
        </Typography>
      )}
      <Stack spacing={0.5}>{children}</Stack>
    </Box>
  );
}
