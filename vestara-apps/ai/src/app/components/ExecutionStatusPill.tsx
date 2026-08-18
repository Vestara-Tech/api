import { Box, Chip, Stack, Typography } from '@mui/material';

export type ExecutionStatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

interface ExecutionStatusPillProps {
  readonly label: string;
  readonly value: string;
  readonly tone?: ExecutionStatusTone;
  readonly detail?: string;
}

const toneToChipColor: Record<ExecutionStatusTone, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  neutral: 'default',
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
};

export function ExecutionStatusPill({ label, value, tone = 'neutral', detail }: ExecutionStatusPillProps) {
  return (
    <Box
      sx={{
        minWidth: 150,
        flex: '1 1 150px',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        px: 1.5,
        py: 1,
        bgcolor: 'background.paper',
      }}
    >
      <Stack direction="row" spacing={1} sx={{ mb: detail ? 0.5 : 0, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.4, color: 'text.secondary' }}>
          {label}
        </Typography>
        <Chip label={value} size="small" color={toneToChipColor[tone]} />
      </Stack>
      {detail ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.35 }}>
          {detail}
        </Typography>
      ) : null}
    </Box>
  );
}
