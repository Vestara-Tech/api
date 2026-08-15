import { Box, Button, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import type { BootStage } from '../../pages/BootPage';

const STAGES: readonly { id: BootStage; label: string }[] = [
  { id: 'firmware', label: 'Firmware' },
  { id: 'grub', label: 'GRUB' },
  { id: 'plymouth', label: 'Plymouth' },
  { id: 'startup', label: 'Startup' },
  { id: 'login', label: 'Login' },
];

export function BootTimeline({
  stage,
  onSelect,
  stageEnabled,
}: {
  stage: BootStage;
  onSelect: (stage: BootStage) => void;
  stageEnabled: Record<BootStage, boolean>;
}) {
  return (
    <Stack direction="row" spacing={0} sx={{ alignItems: 'center', py: 1 }}>
      {STAGES.map((s, i) => (
        <Stack key={s.id} direction="row" spacing={0} sx={{ alignItems: 'center' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {stageEnabled[s.id] ? (
              <CheckCircleIcon fontSize="small" color={stage === s.id ? 'primary' : 'success'} />
            ) : (
              <RadioButtonUncheckedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
            )}
            <Button
              size="small"
              onClick={() => onSelect(s.id)}
              sx={{
                fontWeight: stage === s.id ? 700 : 400,
                color: stage === s.id ? 'primary.main' : 'text.secondary',
                textTransform: 'none', }}
            >
              {s.label}
            </Button>
          </Stack>
          {i < STAGES.length - 1 ? (
            <Box sx={{ width: 24, height: 2, bgcolor: 'divider', mx: 0.5 }} />
          ) : null}
        </Stack>
      ))}
    </Stack>
  );
}
