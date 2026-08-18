import { Box, Chip, Stack, Typography } from '@mui/material';
import type { ActivityRoomTimelineItemShape } from '../../api/aiApi';

interface ExecutionTimelineProps {
  readonly items: readonly ActivityRoomTimelineItemShape[];
}

function toneForStatus(status: string): 'default' | 'info' | 'success' | 'warning' | 'error' {
  const value = status.toLowerCase();
  if (['completed', 'pass', 'approved', 'success'].includes(value)) return 'success';
  if (['failed', 'rejected', 'error'].includes(value)) return 'error';
  if (['pending', 'running', 'queued', 'reviewing', 'verifying'].includes(value)) return 'warning';
  return 'info';
}

export function ExecutionTimeline({ items }: ExecutionTimelineProps) {
  return (
    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
        Execution timeline
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
        Recent agent, workflow, approval, and verification events.
      </Typography>
      <Stack spacing={1}>
        {items.map((item) => (
          <Box key={item.id} sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
            <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 0.5, alignItems: 'center' }}>
              <Chip label={item.kind.replaceAll('-', ' ')} size="small" variant="outlined" />
              <Chip label={item.status} size="small" color={toneForStatus(item.status)} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {item.title}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {item.detail}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {new Date(item.at).toLocaleString()}
            </Typography>
          </Box>
        ))}
        {items.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No recent activity available.
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}
