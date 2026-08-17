import type { ReactNode } from 'react';
import { AppBar, Box, IconButton, Stack, Toolbar, Typography } from '@mui/material';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';

export interface AppHeaderProps {
  readonly appName: ReactNode;
  readonly appDescription?: ReactNode;
  readonly actions?: ReactNode;
  readonly mobile?: boolean;
  readonly sidebarCollapsed?: boolean;
  readonly onToggleSidebar?: () => void;
}

export function AppHeader({
  appName,
  appDescription,
  actions,
  mobile = false,
  sidebarCollapsed = false,
  onToggleSidebar,
}: AppHeaderProps) {
  const ToggleIcon = mobile
    ? MenuRoundedIcon
    : sidebarCollapsed
      ? ChevronRightRoundedIcon
      : ChevronLeftRoundedIcon;

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        color: 'text.primary',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Toolbar sx={{ minHeight: 64, gap: 1.25 }}>
        {onToggleSidebar ? (
          <IconButton
            edge="start"
            aria-label="Toggle navigation"
            onClick={onToggleSidebar}
            size="small"
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}
          >
            <ToggleIcon fontSize="small" />
          </IconButton>
        ) : null}
        <Stack spacing={0.1} sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>
            {appName}
          </Typography>
          {appDescription ? (
            <Typography variant="caption" color="text.secondary" noWrap>
              {appDescription}
            </Typography>
          ) : null}
        </Stack>
        {actions ? <Box sx={{ ml: 'auto' }}>{actions}</Box> : null}
      </Toolbar>
    </AppBar>
  );
}
