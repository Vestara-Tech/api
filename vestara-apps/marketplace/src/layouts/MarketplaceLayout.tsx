import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Box, Stack, Typography } from '@mui/material';
import StorefrontIcon from '@mui/icons-material/Storefront';

const NAV = [
  { to: '/marketplace', label: 'Discover', end: true },
  { to: '/marketplace/installed', label: 'Installed', end: true },
];

export function MarketplaceLayout() {
  const location = useLocation();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <StorefrontIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Marketplace
        </Typography>
        <Box sx={{ mx: 2, width: 1, height: 24, borderLeft: '1px solid', borderColor: 'divider' }} />
        <Stack direction="row" spacing={1}>
          {NAV.map((item) => {
            const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.label}
                to={item.to}
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
        <Box sx={{ flex: 1 }} />
        <Link to="/marketplace" style={{ color: 'inherit', textDecoration: 'none', fontSize: 13 }}>My Library →</Link>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Outlet />
      </Box>
    </Box>
  );
}
