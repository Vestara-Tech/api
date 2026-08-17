import type { ReactNode } from 'react';
import { Box, Divider, Drawer, Stack, Typography, type SxProps, type Theme } from '@mui/material';

import { mergeSx } from '../utils/mergeSx.js';

export interface AppSidebarProps {
  readonly title?: ReactNode;
  readonly subtitle?: ReactNode;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly mobile?: boolean;
  readonly open?: boolean;
  readonly onClose?: () => void;
  readonly collapsed?: boolean;
  readonly width?: number;
  readonly collapsedWidth?: number;
  readonly sx?: SxProps<Theme>;
}

interface SidebarSurfaceProps {
  readonly title?: ReactNode;
  readonly subtitle?: ReactNode;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly collapsed?: boolean;
  readonly width?: number;
  readonly collapsedWidth?: number;
  readonly sx: SxProps<Theme> | undefined;
}

function SidebarSurface({
  title,
  subtitle,
  actions,
  children,
  collapsed = false,
  width = 284,
  collapsedWidth = 84,
  sx,
}: SidebarSurfaceProps) {
  const computedWidth = collapsed ? collapsedWidth : width;

  return (
    <Box
      component="aside"
      sx={mergeSx(
        {
          width: computedWidth,
          flexShrink: 0,
          height: '100%',
          borderRight: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          overflowY: 'auto',
        },
        sx,
      )}
    >
      {(title !== undefined || subtitle !== undefined || actions !== undefined) ? (
        <Box sx={{ px: 2, py: 1.5 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box sx={{ minWidth: 0 }}>
              {title ? (
                <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700 }}>
                  {title}
                </Typography>
              ) : null}
              {subtitle ? (
                <Typography variant="caption" color="text.secondary" noWrap>
                  {subtitle}
                </Typography>
              ) : null}
            </Box>
            {actions ? <Box sx={{ flexShrink: 0 }}>{actions}</Box> : null}
          </Stack>
        </Box>
      ) : null}
      {title !== undefined || subtitle !== undefined || actions !== undefined ? <Divider /> : null}
      <Box sx={{ py: 1 }}>{children}</Box>
    </Box>
  );
}

export function AppSidebar({
  title,
  subtitle,
  actions,
  children,
  mobile = false,
  open = false,
  onClose,
  collapsed = false,
  width = 284,
  collapsedWidth = 84,
  sx,
}: AppSidebarProps) {
  if (mobile) {
    return (
      <Drawer
        open={open}
        onClose={onClose}
        variant="temporary"
        ModalProps={{ keepMounted: true }}
        slotProps={{
          paper: {
            sx: {
              width: Math.min(width, 360),
              bgcolor: 'background.paper',
            },
          },
        }}
      >
        <SidebarSurface
          title={title}
          subtitle={subtitle}
          actions={actions}
          collapsed={collapsed}
          width={width}
          collapsedWidth={collapsedWidth}
          sx={sx}
        >
          {children}
        </SidebarSurface>
      </Drawer>
    );
  }

  return (
    <SidebarSurface
      title={title}
      subtitle={subtitle}
      actions={actions}
      collapsed={collapsed}
      width={width}
      collapsedWidth={collapsedWidth}
      sx={sx}
    >
      {children}
    </SidebarSurface>
  );
}
