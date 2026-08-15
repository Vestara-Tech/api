import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router';
import { Box, Chip, Stack, Typography } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import { useProfile } from '../hooks/useImage';
import { ImageSummary } from '../components/inspector/ImageSummary';
import { ConnectionBanner } from '../components/connectivity/ConnectionBanner';
import { useConnection } from '../hooks/useConnection';
import { apiBase, imageClient } from '../api/client';

const NAV_ITEMS = [
  { to: '', label: 'Overview', section: null },
  { to: '/base', label: 'Base System', section: 'System' },
  { to: '/packages', label: 'Packages', section: 'System' },
  { to: '/boot', label: 'Boot', section: 'Boot Experience' },
  { to: '/startup', label: 'Startup', section: 'Boot Experience' },
  { to: '/login', label: 'Login', section: 'Boot Experience' },
  { to: '/desktop', label: 'Desktop', section: 'Boot Experience' },
  { to: '/apps', label: 'Applications', section: 'Applications' },
  { to: '/security', label: 'Security', section: 'Security' },
  { to: '/recovery', label: 'Recovery', section: 'Recovery' },
  { to: '/configuration', label: 'Configuration', section: 'Configuration' },
  { to: '/build', label: 'Build', section: 'Build' },
];

export function ImageBuilderLayout() {
  const location = useLocation();
  const { profileId } = useParams<{ profileId: string }>();
  const { data: profile } = useProfile(profileId ?? '');
  const { state, retry } = useConnection(imageClient, ['image']);
  const inBuilder = location.pathname.startsWith('/os-image-builder/') && !location.pathname.endsWith('/os-image-builder');

  let lastSection: string | null = null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <ConnectionBanner state={state} apiBase={apiBase} onRetry={retry} />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper', }}
      >
        <StorageIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          OS Image Builder
        </Typography>
        <Box sx={{ mx: 2, width: 1, height: 24, borderLeft: '1px solid', borderColor: 'divider' }} />
        <Link to="/os-image-builder" style={{ color: 'inherit', textDecoration: 'none', fontSize: 14 }}>
          Profiles
        </Link>
        {profileId ? (
          <>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              /
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              {profileId}
            </Typography>
            <Chip size="small" label={`v${profile?.version ?? '…'}`} variant="outlined" />
            <Chip size="small" label="Draft" color="default" />
            <Box sx={{ flex: 1 }} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              profile {profile?.profileHash ? `${profile.profileHash.slice(0, 6)}…${profile.profileHash.slice(-4)}` : '…'}
            </Typography>
          </>
        ) : null}
      </Box>

      {inBuilder && profileId ? (
        <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: '240px 1fr 300px', minHeight: 0 }}>
          <Box sx={{ borderRight: '1px solid', borderColor: 'divider', overflow: 'auto', bgcolor: 'background.paper', p: 1 }}>
            {NAV_ITEMS.map((item) => {
              const section = item.section;
              const showHeader = section !== null && section !== lastSection;
              lastSection = item.section;
              const active = item.to === '' ? location.pathname === `/os-image-builder/${profileId}` : location.pathname === `/os-image-builder/${profileId}${item.to}`;
              return (
                <Box key={item.to || 'overview'}>
                  {showHeader ? (
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 10, color: 'text.secondary', px: 1, mt: 1, mb: 0.25 }}>
                      {section}
                    </Typography>
                  ) : null}
                  <NavLink
                    to={`/os-image-builder/${profileId}${item.to}`}
                    end={item.to === ''}
                    style={{
                      display: 'block',
                      padding: '5px 10px',
                      borderRadius: 6,
                      fontSize: 13,
                      textDecoration: 'none',
                      color: active ? '#8ab4ff' : 'inherit',
                      background: active ? 'rgba(138,180,255,0.08)' : 'transparent', }}
                  >
                    {item.label}
                  </NavLink>
                </Box>
              );
          })}
          </Box>

          <Box sx={{ overflow: 'auto' }}>
            <Outlet />
          </Box>

          <Box sx={{ borderLeft: '1px solid', borderColor: 'divider', overflow: 'auto', bgcolor: 'background.paper' }}>
            <ImageSummary />
          </Box>
        </Box>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <Outlet />
        </Box>
      )}
    </Box>
  );
}
