import { useEffect, useMemo, useState } from 'react';
import { Box, Divider, IconButton, Stack } from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { Outlet, useLocation, useNavigate } from 'react-router';

import {
  AppHeader,
  AppShell,
  AppSidebar,
  NavigationGroup,
  NavigationItem,
  StatusBadge,
  useVestaraThemeSnapshot,
} from '@vestara/ui';

import { useCapabilityNavigation } from '../navigation/CapabilityNavigationProvider.js';
import { resolveWorkspaceNavigation, WORKSPACE_NAVIGATION } from '../navigation/navigation.js';

function useResponsiveSidebar(): boolean {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const update = (): void => {
      setMobile(window.innerWidth < 960);
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return mobile;
}

export function WorkspaceLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const mobile = useResponsiveSidebar();
  const themeSnapshot = useVestaraThemeSnapshot();
  const capabilityNavigation = useCapabilityNavigation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const resolvedNavigation = useMemo(
    () =>
      resolveWorkspaceNavigation(
        WORKSPACE_NAVIGATION,
        capabilityNavigation.enabledCapabilities,
        location.pathname,
        capabilityNavigation.status !== 'ready',
      ),
    [capabilityNavigation.enabledCapabilities, capabilityNavigation.status, location.pathname],
  );

  const headerActions = (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <StatusBadge
        label={capabilityNavigation.status === 'ready' ? 'Capabilities ready' : capabilityNavigation.status === 'error' ? 'Capabilities offline' : 'Capabilities loading'}
        tone={capabilityNavigation.status === 'ready' ? 'healthy' : capabilityNavigation.status === 'error' ? 'warning' : 'neutral'}
      />
      <StatusBadge label={themeSnapshot.source === 'remote' ? 'Remote theme' : 'Fallback theme'} tone={themeSnapshot.source === 'remote' ? 'healthy' : 'warning'} />
      <IconButton
        onClick={async () => {
          await capabilityNavigation.refresh();
        }}
        aria-label="Refresh capabilities"
        size="small"
      >
        <RefreshRoundedIcon fontSize="small" />
      </IconButton>
    </Stack>
  );

  const sidebar = (
    <AppSidebar
      title="Vestara Workspace"
      subtitle="Authoring shell"
      mobile={mobile}
      open={mobile ? mobileSidebarOpen : false}
      onClose={() => setMobileSidebarOpen(false)}
      collapsed={!mobile && sidebarCollapsed}
      width={292}
      collapsedWidth={84}
    >
      {resolvedNavigation.map((group) => (
        <NavigationGroup key={group.id} label={group.label} compact={!mobile && sidebarCollapsed}>
          {group.items.map((item) => (
            <NavigationItem
              key={item.id}
              label={item.label}
              description={item.description}
              selected={item.selected}
              disabled={!item.available}
              compact={!mobile && sidebarCollapsed}
              badge={!item.available ? <StatusBadge label="Unavailable" tone="warning" /> : undefined}
              onClick={() => {
                if (!item.available) return;
                navigate(item.href);
                if (mobile) setMobileSidebarOpen(false);
              }}
            />
          ))}
        </NavigationGroup>
      ))}
      <Divider sx={{ my: 1 }} />
      <Box sx={{ px: 1.5, pb: 1.5 }}>
        <StatusBadge label={capabilityNavigation.status === 'ready' ? 'Navigation synced' : 'Navigation loading'} tone={capabilityNavigation.status === 'ready' ? 'healthy' : 'neutral'} />
      </Box>
    </AppSidebar>
  );

  return (
    <AppShell
      header={
        <AppHeader
          appName="Vestara Workspace"
          appDescription="Authoring and composition shell"
          sidebarCollapsed={sidebarCollapsed}
          mobile={mobile}
          onToggleSidebar={() => {
            if (mobile) {
              setMobileSidebarOpen((value) => !value);
            } else {
              setSidebarCollapsed((value) => !value);
            }
          }}
          actions={headerActions}
        />
      }
      sidebar={sidebar}
    >
      <Outlet />
    </AppShell>
  );
}
