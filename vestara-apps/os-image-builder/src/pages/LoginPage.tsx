import {
  Box,
  Button,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useImageBuilder } from '../context/ImageBuilderContext';

export function LoginPage() {
  const { profile, patch } = useImageBuilder();
  if (!profile) return null;

  const login = profile.login;

  return (
    <Box sx={{ p: 3, maxWidth: 720 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Login
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        The OS-level security boundary. Authentication is PAM-backed; the UI never validates.
      </Typography>

      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 2 }}>
        <Typography sx={{ fontWeight: 600, mb: 1 }}>Authentication</Typography>
        <Stack spacing={1.5}>
          <TextField
            select
            label="Provider"
            value={login.provider}
            size="small"
            sx={{ maxWidth: 240 }}
          >
            <MenuItem value="vestara">vestara</MenuItem>
          </TextField>
          <FormControlLabel
            control={<Switch size="small" checked={login.password} onChange={() => void patch((d) => ({ ...d, login: { ...d.login, password: !d.login.password }}))} />}
            label={<Typography variant="body2">Password login</Typography>}
          />
          <FormControlLabel
            control={<Switch size="small" checked={login.fingerprint === 'auto'} onChange={() => void patch((d) => ({ ...d, login: { ...d.login, fingerprint: d.login.fingerprint === 'auto' ? 'disabled' : 'auto' }}))} />}
            label={<Typography variant="body2">Fingerprint (auto)</Typography>}
          />
          <FormControlLabel
            control={<Switch size="small" checked={login.fido2 === 'auto'} onChange={() => void patch((d) => ({ ...d, login: { ...d.login, fido2: d.login.fido2 === 'auto' ? 'disabled' : 'auto' }}))} />}
            label={<Typography variant="body2">FIDO2 (auto)</Typography>}
          />
        </Stack>
      </Box>

      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
        Pre-auth capability boundary: greeter never touches builder, generator, config-secrets,
        marketplace, filesystem or agents.
      </Typography>
    </Box>
  );
}
