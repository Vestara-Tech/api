import { Box, Chip, Stack, Typography } from '@mui/material';
import { memo } from 'react';
import type { VestaraMessage, VestaraMessagePart } from '../../model/message';
import { ToolCallView } from '../tool-call/ToolCallView';
import { ApprovalView } from '../approval/ApprovalView';

/**
 * MessagePartRenderer — renders a single VestaraMessagePart. Reusable by the
 * Activity Room, AI Chat, Agent Workspace and any embedded assistant surface.
 */
export const MessagePartRenderer = memo(function MessagePartRenderer({ part, onApprove, onReject }: { part: VestaraMessagePart; onApprove: ((id: string) => void) | undefined; onReject: ((id: string) => void) | undefined }) {  switch (part.kind) {
    case 'text':
      return <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{part.text}</Typography>;
    case 'code':
      return (
        <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
          {part.code}
        </Box>
      );
    case 'file':
      return (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Chip size="small" label={`📄 ${part.name}`} variant="outlined" />
          {part.size !== undefined ? <Typography variant="caption" sx={{ color: 'text.secondary' }}>{part.size} B</Typography> : null}
        </Stack>
      );
    case 'image':
      return part.url ? <Box component="img" src={part.url} alt={part.alt ?? ''} sx={{ maxWidth: 240, borderRadius: 1 }} /> : null;
    case 'tool-call':
      return <ToolCallView call={part} />;
    case 'tool-result':
      return (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Chip size="small" label={part.ok ? '✓ tool result' : '✗ tool failed'} color={part.ok ? 'success' : 'error'} />
          {part.output !== undefined ? <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>{stringify(part.output)}</Typography> : null}
        </Stack>
      );
    case 'approval':
      return <ApprovalView approval={part} onApprove={onApprove} onReject={onReject} />;
    case 'agent-activity':
      return (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Chip size="small" label={part.agentName} color="info" variant="outlined" />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>{part.activity}</Typography>
          {part.detail ? <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>{part.detail}</Typography> : null}
        </Stack>
      );
    case 'workflow':
      return <Chip size="small" label={`workflow ${part.workflowId} · ${part.stage} (${part.status})`} variant="outlined" />;
    case 'artifact':
      return <Chip size="small" label={`📦 ${part.name}`} color="primary" variant="outlined" />;
    case 'evidence':
      return (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Chip size="small" label="🛡 evidence" color="success" variant="outlined" />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{part.summary}</Typography>
          {part.bundleHash ? <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.disabled' }}>{part.bundleHash.slice(0, 12)}</Typography> : null}
        </Stack>
      );
    case 'context':
      return (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
          <Chip size="small" label="ctx" variant="outlined" />
          <Box sx={{ minWidth: 0 }}>
            {part.title ? <Typography variant="body2" sx={{ fontWeight: 600 }}>{part.title}</Typography> : null}
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{part.content.slice(0, 200)}{part.content.length > 200 ? '…' : ''}</Typography>
          </Box>
        </Stack>
      );
    case 'generation':
      return <Chip size="small" label={`⚙ ${part.generatorId} (${part.status})`} variant="outlined" />;
    case 'error':
      return <Chip size="small" label={`✗ ${part.message}`} color="error" />;
    default:
      return null;
  }
});

export function MessageView({ message, onApprove, onReject }: { message: VestaraMessage; onApprove: ((id: string) => void) | undefined; onReject: ((id: string) => void) | undefined }) {
  return (
    <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
      <Chip size="small" label={message.authorName ?? message.role} color={message.role === 'user' ? 'primary' : message.role === 'agent' ? 'info' : 'default'} variant={message.role === 'user' ? 'filled' : 'outlined'} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {message.parts.map((part, i) => (
          <MessagePartRenderer key={i} part={part} onApprove={onApprove} onReject={onReject} />
        ))}
      </Box>
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
