import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router';
import { Box, Stack, Typography } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';

const NAV = [
  { to: '', label: 'Builder', end: true },
  { to: '/test', label: 'Test Agent', end: false },
];

export function AgentBuilderLayout() {
  const location = useLocation();
  const { agentId } = useParams<{ agentId: string }>();
  const inBuilder = location.pathname.startsWith('/agent-builder/') && !location.pathname.endsWith('/agent-builder');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <SmartToyIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Agent Builder
        </Typography>
        <Box sx={{ mx: 2, width: 1, height: 24, borderLeft: '1px solid', borderColor: 'divider' }} />
        <Link to="/agent-builder" style={{ color: 'inherit', textDecoration: 'none', fontSize: 14 }}>
          Agents
        </Link>
        {agentId ? (
          <>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>/</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{agentId}</Typography>
          </>
        ) : null}
        {inBuilder && agentId ? (
          <Stack direction="row" spacing={1} sx={{ ml: 2 }}>
            {NAV.map((item) => {
              const active = item.end ? location.pathname === `/agent-builder/${agentId}` : location.pathname === `/agent-builder/${agentId}/test`;
              return (
                <NavLink
                  key={item.label}
                  to={`/agent-builder/${agentId}${item.to}`}
                  end={item.end}
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
        ) : null}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Outlet />
      </Box>
    </Box>
  );
}
