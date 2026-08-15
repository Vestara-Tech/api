import { Box, Chip, LinearProgress, Stack, Typography } from '@mui/material';

export interface ContextInspectorItem {
  readonly source: string;
  readonly title?: string;
  readonly content: string;
  readonly tokenEstimate?: number;
  readonly required: boolean;
}

export interface ContextInspectorProps {
  readonly items: readonly ContextInspectorItem[];
  readonly usedTokens: number;
  readonly availableTokens: number;
}

/**
 * ContextInspector — shows what the agent is actually being given (token budget
 * + per-source breakdown), fulfilling the "what did the agent see" requirement.
 */
export function ContextInspector({ items, usedTokens, availableTokens }: ContextInspectorProps) {
  const pct = availableTokens > 0 ? Math.min(100, Math.round((usedTokens / availableTokens) * 100)) : 0;
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 1.5 }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between',  mb: 0.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary' }}>
          Context
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {usedTokens.toLocaleString()} / {availableTokens.toLocaleString()} tokens
        </Typography>
      </Stack>
      <LinearProgress variant="determinate" value={pct} sx={{ mb: 1 }} />
      <Stack spacing={0.5}>
        {items.map((item, i) => (
          <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <Chip size="small" label={item.required ? 'REQ' : item.source} color={item.required ? 'primary' : 'default'} variant={item.required ? 'filled' : 'outlined'} />
            <Box sx={{ minWidth: 0 }}>
              {item.title ? <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.title}</Typography> : null}
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{item.content.slice(0, 120)}{item.content.length > 120 ? '…' : ''}</Typography>
              {item.tokenEstimate !== undefined ? <Typography variant="caption" sx={{ color: 'text.disabled' }}>{item.tokenEstimate} tok</Typography> : null}
            </Box>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
