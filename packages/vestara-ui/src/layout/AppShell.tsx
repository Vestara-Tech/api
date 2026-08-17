import type { ReactNode } from 'react';
import { Box, type SxProps, type Theme } from '@mui/material';

import { mergeSx } from '../utils/mergeSx.js';

export interface AppShellProps {
  readonly header: ReactNode;
  readonly sidebar?: ReactNode;
  readonly children: ReactNode;
  readonly sx?: SxProps<Theme>;
}

export function AppShell({ header, sidebar, children, sx }: AppShellProps) {
  return (
    <Box
      sx={mergeSx(
        {
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          bgcolor: 'background.default',
          color: 'text.primary',
        },
        sx,
      )}
    >
      {header}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {sidebar ? <Box sx={{ flexShrink: 0 }}>{sidebar}</Box> : null}
        <Box component="main" sx={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
