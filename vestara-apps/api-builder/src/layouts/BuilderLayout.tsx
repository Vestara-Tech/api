import { Outlet, Link, useLocation } from 'react-router';
import { Box, Typography } from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';

export function BuilderLayout() {
  const location = useLocation();
  const definitionMatch = location.pathname.match(/^\/definitions\/([^/]+)/);
  const definitionId = definitionMatch?.[1];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <CodeIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          API Builder
        </Typography>
        <Box sx={{ mx: 2, width: 1, height: 24, borderLeft: '1px solid', borderColor: 'divider' }} />
        <Link
          to={definitionId ? `/definitions/${definitionId}` : '/definitions'}
          style={{ color: 'inherit', textDecoration: 'none', fontSize: 14 }}
        >
          Definitions
        </Link>
        {definitionId ? (
          <>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              /
            </Typography>
            <Link
              to={`/definitions/${definitionId}`}
              style={{ color: 'inherit', textDecoration: 'none', fontSize: 14 }}
            >
              {definitionId}
            </Link>
          </>
        ) : null}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
