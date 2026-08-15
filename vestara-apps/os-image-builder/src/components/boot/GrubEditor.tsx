import { useState } from 'react';
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
import { useImageBuilder } from '../../context/ImageBuilderContext';

export function GrubEditor() {
  const { profile, patch } = useImageBuilder();
  if (!profile) return null;
  const grub = profile.boot.grub;

  const [timeout, setTimeoutValue] = useState(String(grub.timeout));

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography sx={{ fontWeight: 600 }}>GRUB</Typography>
        <Chip
          label={grub.enabled ? 'Enabled' : 'Disabled'}
          color={grub.enabled ? 'success' : 'default'}
          onClick={() => void patch((d) => ({ ...d, boot: { ...d.boot, grub: { ...d.boot.grub, enabled: !d.boot.grub.enabled }} }))}
          clickable
          size="small"
        />
      </Stack>

      <Stack spacing={2} sx={{ maxWidth: 460 }}>
        <TextField
          label="Default entry"
          value="Vestara A"
          disabled
          helperText="A/B slots: the default entry is managed by the image builder."
        />
        <TextField
          label="Timeout (seconds)"
          value={timeout}
          onChange={(e) => setTimeoutValue(e.target.value)}
          onBlur={() => {
            const n = Number.parseInt(timeout, 10);
            if (!Number.isNaN(n) && n >= 0) void patch((d) => ({ ...d, boot: { ...d.boot, grub: { ...d.boot.grub, timeout: n }} }));
            else setTimeoutValue(String(grub.timeout)); }}
        />
        <TextField
          select
          label="Menu style"
          value={grub.theme ?? 'vestara-dark'}
          onChange={(e) => void patch((d) => ({ ...d, boot: { ...d.boot, grub: { ...d.boot.grub, theme: e.target.value }} }))}
        >
          <MenuItem value="vestara-dark">Vestara Dark</MenuItem>
          <MenuItem value="vestara-light">Vestara Light</MenuItem>
          <MenuItem value="minimal">Countdown</MenuItem>
        </TextField>

        <Stack spacing={0}>
          <FormControlLabel
            control={<Switch size="small" checked={profile.system.recovery} onChange={() => void patch((d) => ({ ...d, system: { ...d.system, recovery: !d.system.recovery }}))} />}
            label={<Typography variant="body2">Recovery entry</Typography>}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', ml: 4 }}>
            Adds a recovery entry to the boot menu.
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            onClick={() => {
              const n = Number.parseInt(timeout, 10);
              if (!Number.isNaN(n) && n >= 0) {
                void patch((d) => ({ ...d, boot: { ...d.boot, grub: { ...d.boot.grub, timeout: n }} }));
              }
            }}
          >
            Save GRUB
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
