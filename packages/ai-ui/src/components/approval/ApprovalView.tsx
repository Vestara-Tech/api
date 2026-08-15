import { Alert, Button, Chip, Stack, Typography } from '@mui/material';
import type { ApprovalPart } from '../../model/message';

/**
 * ApprovalView — renders a pending approval and its human decision actions.
 * The decision flows back through the Vestara approval API (never through the
 * AI provider).
 */
export function ApprovalView({ approval, onApprove, onReject }: { approval: ApprovalPart; onApprove: ((id: string) => void) | undefined; onReject: ((id: string) => void) | undefined }) {
  const riskColor = approval.risk === 'critical' ? 'error' : approval.risk === 'high' ? 'warning' : 'info';
  return (
    <Alert severity={approval.status === 'pending' ? 'warning' : approval.status === 'approved' ? 'success' : 'error'} sx={{ '& .MuiAlert-message': { width: '100%' } }}>
      <Stack spacing={0.5}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{approval.subject}</Typography>
          <Chip size="small" label={approval.risk} color={riskColor} />
          <Chip size="small" label={approval.status} variant="outlined" />
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Tool {approval.toolId} requires human approval. AI never bypasses this gate.
        </Typography>
        {approval.status === 'pending' && onApprove && onReject ? (
          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
            <Button size="small" variant="contained" color="success" onClick={() => onApprove(approval.approvalId)}>
              Approve
            </Button>
            <Button size="small" variant="outlined" color="error" onClick={() => onReject(approval.approvalId)}>
              Reject
            </Button>
          </Stack>
        ) : null}
      </Stack>
    </Alert>
  );
}
