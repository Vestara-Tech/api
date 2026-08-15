import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useImageBuilder } from '../context/ImageBuilderContext';

export function StartupPage() {
  const { profile, patch } = useImageBuilder();
  if (!profile) return null;

  return (
    <Box sx={{ p: 3, maxWidth: 720 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Startup
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        The Startup coordinator boots services in dependency order and routes to the right destination
        after readiness is verified.
      </Typography>

      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 2 }}>
        <Typography sx={{ fontWeight: 600, mb: 1 }}>Startup coordinator</Typography>
        <Stack spacing={1}>
          <Chip label="booting → initializing → starting-services → verifying → ready" size="small" variant="outlined" />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Destinations: onboarding · login · desktop · diagnostics · recovery
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}
