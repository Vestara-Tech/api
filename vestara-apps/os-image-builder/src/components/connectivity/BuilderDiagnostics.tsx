import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import { useBuilderDiagnostics } from '../../hooks/useBuilderDiagnostics';

/**
 * IMG-030 — Builder diagnostics surface. Where "Failed to load profiles"
 * leads: API, capability, configuration, profile checks with a retry, instead
 * of a guess. Diagnostics observes and investigates; it never repairs.
 */
export function BuilderDiagnostics({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { runData, isRunning, error, run: rerun } = useBuilderDiagnostics();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>OS Image Builder Diagnostics</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          {error ? <Alert severity="error">Diagnostics failed: {error.message}</Alert> : null}
          {isRunning && !runData ? (
            <Stack sx={{ alignItems: 'center', py: 3 }}>
              <CircularProgress size={28} />
              <Typography variant="caption" sx={{ mt: 1, color: 'text.secondary' }}>
                Running checks…
              </Typography>
            </Stack>
          ) : null}

          {runData
            ? runData.checks.map((check) => {
                const Icon = check.status === 'pass' ? CheckCircleIcon : check.status === 'fail' ? ErrorIcon : WarningIcon;
                const color = check.status === 'pass' ? 'success.main' : check.status === 'fail' ? 'error.main' : 'warning.main';
                return (
                  <Box key={check.checkId} sx={{ display: 'flex', gap: 1 }}>
                    <Icon sx={{ color, fontSize: 18, mt: 0.25 }} />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {check.message}
                      </Typography>
                      {check.detail ? (
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                          {check.detail}
                        </Typography>
                      ) : null}
                    </Box>
                  </Box>
                );
              })
            : null}

          {runData && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {runData.counts.healthy} healthy · {runData.counts.degraded} degraded · {runData.counts.failed} failed
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={rerun} disabled={isRunning}>
          Re-run
        </Button>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
