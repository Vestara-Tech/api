import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { useImageBuilder } from '../context/ImageBuilderContext';

const RECOVERY_ITEMS = ['startup', 'diagnostics', 'recovery'];

export function RecoveryPage() {
  const { profile, patch } = useImageBuilder();
  if (!profile) return null;
  const recovery = profile.recovery;

  const toggleItem = async (item: string) => {
    const next = recovery.includes.includes(item)
      ? recovery.includes.filter((i) => i !== item)
      : [...recovery.includes, item];
    await patch((d) => ({ ...d, recovery: { ...d.recovery, includes: next } }));
  };

  return (
    <Box sx={{ p: 3, maxWidth: 720 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Recovery
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        What the recovery environment carries so the machine can be repaired.
      </Typography>

      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 2 }}>
        <Stack spacing={1}>
          <FormControlLabel
            control={<Switch size="small" checked={recovery.enabled} onChange={() => void patch((d) => ({ ...d, recovery: { ...d.recovery, enabled: !d.recovery.enabled }}))} />}
            label={<Typography variant="body2">Recovery environment</Typography>}
          />
          {recovery.enabled ? (
            <>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mt: 1 }}>
                Includes
              </Typography>
              <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                {RECOVERY_ITEMS.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    variant={recovery.includes.includes(item) ? 'filled' : 'outlined'}
                    color={recovery.includes.includes(item) ? 'primary' : 'default'}
                    onClick={() => void toggleItem(item)}
                    clickable
                  />
                ))}
              </Stack>
            </>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Recovery is disabled — A/B rollback still works at the bootloader level.
            </Typography>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
