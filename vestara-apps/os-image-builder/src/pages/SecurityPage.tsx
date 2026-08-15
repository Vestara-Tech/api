import {
  Box,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { useImageBuilder } from '../context/ImageBuilderContext';

export function SecurityPage() {
  const { profile, patch } = useImageBuilder();
  if (!profile) return null;
  const security = profile.security;

  return (
    <Box sx={{ p: 3, maxWidth: 720 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Security
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Images are unowned at build time. No user password, no owner, no credentials baked in.
      </Typography>

      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 2 }}>
        <Stack spacing={1}>
          <FormControlLabel
            control={<Switch size="small" checked={security.noDefaultOwner} onChange={() => void patch((d) => ({ ...d, security: { ...d.security, noDefaultOwner: !d.security.noDefaultOwner }}))} />}
            label={<Typography variant="body2">No default owner</Typography>}
          />
          <FormControlLabel
            control={<Switch size="small" checked={security.sanitizeSecrets} onChange={() => void patch((d) => ({ ...d, security: { ...d.security, sanitizeSecrets: !d.security.sanitizeSecrets }}))} />}
            label={<Typography variant="body2">Sanitize secrets</Typography>}
          />
        </Stack>
      </Box>

      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
        First boot runs onboarding to create and link the owner and generate machine-specific secrets.
      </Typography>
    </Box>
  );
}
