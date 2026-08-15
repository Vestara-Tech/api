import {
  Box,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import { useImageBuilder } from '../context/ImageBuilderContext';

export function ConfigurationPage() {
  const { profile } = useImageBuilder();
  if (!profile) return null;

  return (
    <Box sx={{ p: 3, maxWidth: 720 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Configuration
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        The image is assembled from the shared System, Config, Auth, Generator, Onboarding,
        Startup and Login contracts — never from ad-hoc shell fragments.
      </Typography>

      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 2 }}>
        <Stack spacing={0.5}>
          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography variant="body2">A/B slots</Typography>
            <Chip size="small" label={profile.system.abSlots ? 'on' : 'off'} color={profile.system.abSlots ? 'success' : 'default'} />
          </Stack>
          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography variant="body2">First-boot onboarding</Typography>
            <Chip size="small" label={profile.onboarding.firstBoot ? 'enabled' : 'disabled'} color={profile.onboarding.firstBoot ? 'success' : 'default'} />
          </Stack>
          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography variant="body2">Firmware logo</Typography>
            <Chip size="small" label={profile.boot.firmwareLogo.mode} color="info" />
          </Stack>
          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography variant="body2">Sanitize</Typography>
            <Chip size="small" label={`noDefaultOwner=${profile.security.noDefaultOwner}, sanitizeSecrets=${profile.security.sanitizeSecrets}`} />
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
