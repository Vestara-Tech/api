import { useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import type { PackageDetail } from '../../api/marketplaceApi';
import { marketplaceApi } from '../../api/marketplaceApi';
import { PermissionReview } from './PermissionReview';

const HIGH_RISK = ['high', 'critical'];

/** InstallDialog — the governed installation review (approval gate). */
export function InstallDialog({ pkg, open, onClose, onInstalled }: { pkg: PackageDetail; open: boolean; onClose: () => void; onInstalled: () => void }) {
  const [approve, setApprove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const highCount = pkg.permissions.filter((p) => p.approval === 'explicit' || HIGH_RISK.includes(riskOf(p.id))).length;

  const handleInstall = async () => {
    setBusy(true);
    setError(null);
    try {
      await marketplaceApi.install(pkg.id, approve);
      onInstalled();
      onClose();
    } catch (err) {
      const e = err as Error & { code?: string };
      setError(e.code === 'APPROVAL_REQUIRED' ? 'This package requires explicit approval.' : e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Install {pkg.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <PermissionReview pkg={pkg} />
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 0.5 }}>
              Installation Review
            </Typography>
            <Typography variant="body2">{pkg.permissions.length} permissions requested</Typography>
            {highCount > 0 ? (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {highCount} permission{highCount === 1 ? '' : 's'} require approval:
                {pkg.permissions.filter((p) => p.approval === 'explicit' || HIGH_RISK.includes(riskOf(p.id))).map((p) => ` ${p.id}`).join(',')}
              </Alert>
            ) : null}
          </Box>
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => void handleInstall()} disabled={busy || highCount > 0}>
          {highCount > 0 ? 'Approval required' : 'Install'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function riskOf(permissionId: string): string {
  if (permissionId.includes('process') || permissionId.includes('execute') || permissionId.includes('workflow')) return 'high';
  if (permissionId.includes('shell.root')) return 'critical';
  return 'medium';
}
