import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useImageBuilder } from '../context/ImageBuilderContext';
import { APP_CATALOG } from '../types/domain';

export function DesktopPage() {
  const { profile, patch } = useImageBuilder();
  const [session, setSession] = useState(profile?.desktop.session ?? 'vestara');
  const [startupApp, setStartupApp] = useState(profile?.desktop.startupApp ?? '');
  const [desktopApp, setDesktopApp] = useState(profile?.desktop.desktopApp ?? '');

  useEffect(() => {
    if (profile) {
      setSession(profile.desktop.session);
      setStartupApp(profile.desktop.startupApp);
      setDesktopApp(profile.desktop.desktopApp);
    }
  }, [profile]);

  if (!profile) return null;

  const appNames = APP_CATALOG.filter((a) => profile.applications.applications.includes(a.id)).map((a) => a.id);

  return (
    <Box sx={{ p: 3, maxWidth: 720 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Desktop
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        The desktop session and which app runs at the desktop after login.
      </Typography>

      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 2 }}>
        <Stack spacing={2} sx={{ maxWidth: 420 }}>
          <TextField
            select
            label="Session"
            value={session}
            onChange={(e) => setSession(e.target.value as 'vestara' | 'fallback')}
          >
            <MenuItem value="vestara">Vestara Desktop</MenuItem>
            <MenuItem value="fallback">Fallback (no desktop)</MenuItem>
          </TextField>
          <TextField
            select
            label="Startup app"
            value={startupApp}
            onChange={(e) => setStartupApp(e.target.value)}
            disabled={appNames.length === 0}
          >
            <MenuItem value="">— none —</MenuItem>
            {appNames.map((id) => (
              <MenuItem key={id} value={id}>
                {id}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Desktop app"
            value={desktopApp}
            onChange={(e) => setDesktopApp(e.target.value)}
            disabled={appNames.length === 0}
          >
            <MenuItem value="">— none —</MenuItem>
            {appNames.map((id) => (
              <MenuItem key={id} value={id}>
                {id}
              </MenuItem>
            ))}
          </TextField>
          <Box>
            <Button
              variant="contained"
              onClick={() =>
                void patch((d) => ({
                  ...d,
                  desktop: {
                    session,
                    startupApp,
                    desktopApp,
                  },
                }))
              }
            >
              Save Desktop
            </Button>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
