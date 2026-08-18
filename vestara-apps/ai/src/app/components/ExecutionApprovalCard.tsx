import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import type { ActivityRoomApprovalShape } from '../../api/aiApi';

interface ExecutionApprovalCardProps {
  readonly approvals: readonly ActivityRoomApprovalShape[];
  readonly onApprove?: (approvalId: string) => void;
  readonly onReject?: (approvalId: string) => void;
  readonly busyApprovalId?: string | null;
  readonly error?: string | null;
}

function toneForApprovalStatus(status: string): 'default' | 'info' | 'success' | 'warning' | 'error' {
  const value = status.toLowerCase();
  if (value === 'approved') return 'success';
  if (value === 'rejected') return 'error';
  if (value === 'pending') return 'warning';
  return 'info';
}

export function ExecutionApprovalCard({ approvals, onApprove, onReject, busyApprovalId, error }: ExecutionApprovalCardProps) {
  return (
    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
        Approvals
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
        Governed actions routed through permissions before apply.
      </Typography>
      {error ? (
        <Box sx={{ mb: 1.5, p: 1, borderRadius: 1.25, border: '1px solid', borderColor: 'error.main', bgcolor: 'error.light' }}>
          <Typography variant="body2" sx={{ color: 'error.dark' }}>
            {error}
          </Typography>
        </Box>
      ) : null}

      <Stack spacing={1}>
        {approvals.map((approval) => {
          const pending = approval.status === 'pending';
          const busy = busyApprovalId === approval.id;
          return (
            <Box key={approval.id} sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
              <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 0.75, alignItems: 'center' }}>
                <Chip label={approval.risk} size="small" variant="outlined" />
                <Chip label={approval.status} size="small" color={toneForApprovalStatus(approval.status)} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {approval.subject}
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {approval.toolId} · {approval.agentId}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                Requested {new Date(approval.requestedAt).toLocaleString()}
                {approval.decidedAt ? ` · Decided ${new Date(approval.decidedAt).toLocaleString()}` : ''}
                {approval.decidedBy ? ` · By ${approval.decidedBy}` : ''}
              </Typography>
              {pending && (onApprove || onReject) ? (
                <Stack direction="row" spacing={1}>
                  {onApprove ? (
                    <Button size="small" variant="contained" onClick={() => onApprove(approval.id)} disabled={busy}>
                      {busy ? 'Working…' : 'Approve'}
                    </Button>
                  ) : null}
                  {onReject ? (
                    <Button size="small" variant="outlined" color="error" onClick={() => onReject(approval.id)} disabled={busy}>
                      Reject
                    </Button>
                  ) : null}
                </Stack>
              ) : null}
            </Box>
          );
        })}
        {approvals.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No approvals pending.
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}
