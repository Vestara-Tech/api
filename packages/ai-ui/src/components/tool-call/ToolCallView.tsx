import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import type { ToolCallPart } from '../../model/message';

/** ToolCallView — renders a tool call with its status. */
export function ToolCallView({ call }: { call: ToolCallPart }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Chip
        size="small"
        label={`🔧 ${call.name}`}
        color={call.status === 'failed' ? 'error' : call.status === 'completed' ? 'success' : call.status === 'running' ? 'info' : 'default'}
        variant="outlined"
      />
      {call.arguments !== undefined ? (
        <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
          {stringify(call.arguments)}
        </Typography>
      ) : null}
    </Stack>
  );
}

export function ToolCallSummary({ calls }: { calls: readonly ToolCallPart[] }) {
  const running = calls.filter((c) => c.status === 'running').length;
  const completed = calls.filter((c) => c.status === 'completed').length;
  const failed = calls.filter((c) => c.status === 'failed').length;
  return (
    <Stack direction="row" spacing={0.5}>
      <Chip size="small" label={`${calls.length} tool calls`} />
      {running > 0 ? <Chip size="small" label={`● ${running}`} color="info" /> : null}
      {completed > 0 ? <Chip size="small" label={`✓ ${completed}`} color="success" /> : null}
      {failed > 0 ? <Chip size="small" label={`✗ ${failed}`} color="error" /> : null}
    </Stack>
  );
}

function stringify(value: unknown): string {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function ToolCallActions({ name, onViewArguments }: { name: string; onViewArguments?: () => void }) {
  return (
    <Box>
      <Button size="small" onClick={onViewArguments}>View arguments</Button>
    </Box>
  );
}
