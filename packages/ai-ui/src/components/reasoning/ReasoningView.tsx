import { Box, Chip, LinearProgress, Stack, Typography } from '@mui/material';

export interface ReasoningViewProps {
  readonly steps: readonly { title: string; detail?: string; status: 'done' | 'running' | 'pending' }[];
}

/** ReasoningView — renders a chain-of-thought / reasoning trace. */
export function ReasoningView({ steps }: ReasoningViewProps) {
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 1.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
        Reasoning
      </Typography>
      <Stack spacing={0.75}>
        {steps.map((step, i) => (
          <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Chip size="small" label={step.status === 'done' ? '✓' : step.status === 'running' ? '●' : '○'} color={step.status === 'done' ? 'success' : step.status === 'running' ? 'info' : 'default'} />
            <Typography variant="body2">{step.title}</Typography>
            {step.detail ? <Typography variant="caption" sx={{ color: 'text.secondary' }}>{step.detail}</Typography> : null}
          </Stack>
        ))}
      </Stack>
      {steps.some((s) => s.status === 'running') ? <LinearProgress sx={{ mt: 1 }} /> : null}
    </Box>
  );
}
