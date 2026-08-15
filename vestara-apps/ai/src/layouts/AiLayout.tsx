import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Box, Stack, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

const NAV = [
  { to: '/ai/activity', label: 'Activity Room' },
  { to: '/ai/chat', label: 'AI Chat' },
  { to: '/ai/agents', label: 'Agent Workspace' },
];

export function AiLayout() {
  const location = useLocation();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <AutoAwesomeIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          AI Experience
        </Typography>
        <Box sx={{ mx: 2, width: 1, height: 24, borderLeft: '1px solid', borderColor: 'divider' }} />
        <Stack direction="row" spacing={1}>
          {NAV.map((item) => {
            const active = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  fontSize: 13,
                  textDecoration: 'none',
                  color: active ? '#8ab4ff' : 'inherit',
                  background: active ? 'rgba(138,180,255,0.08)' : 'transparent',
                }}
              >
                {item.label}
              </NavLink>
            );
          })}
        </Stack>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Outlet />
      </Box>
    </Box>
  );
}
