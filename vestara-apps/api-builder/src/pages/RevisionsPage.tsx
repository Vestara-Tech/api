import { useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import UndoIcon from '@mui/icons-material/Undo';
import { useRevisions, useRollback } from '../hooks/useBuilder';

export function RevisionsPage() {
  const { definitionId } = useParams<{ definitionId: string }>();
  const { data: revisions, isLoading, isError } = useRevisions(definitionId ?? '');
  const rollback = useRollback(definitionId ?? '');
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!definitionId) return null;

  const handleRollback = async () => {
    setConfirmOpen(false);
    await rollback.mutateAsync();
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1000 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 2  }}>
        <Button component={Link} to={`/definitions/${definitionId}`} startIcon={<ArrowBackIcon />} size="small">
          Back
        </Button>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Published Revisions
        </Typography>
      </Stack>

      {isError ? <Alert severity="error">Failed to load revisions.</Alert> : null}
      {isLoading ? <Typography sx={{ color: 'text.secondary' }}>Loading…</Typography> : null}

      <Table size="small" sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        <TableHead>
          <TableRow>
            <TableCell>Revision</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Contract Hash</TableCell>
            <TableCell>Recorded</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(revisions ?? []).map((rev) => (
            <TableRow key={rev.definition.revision}>
              <TableCell>#{rev.definition.revision}</TableCell>
              <TableCell>
                <Chip label={rev.definition.status} size="small" color={rev.definition.status === 'published' ? 'success' : 'default'} />
              </TableCell>
              <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{rev.compiledHash.slice(0, 16)}…</TableCell>
              <TableCell>{rev.recordedAt}</TableCell>
            </TableRow>
          ))}
          {(revisions ?? []).length === 0 && !isLoading ? (
            <TableRow>
              <TableCell colSpan={4} sx={{ color: 'text.secondary' }}>
                No revisions published yet.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      {(revisions ?? []).length > 1 ? (
        <Box sx={{ mt: 2 }}>
          <Button
            variant="outlined"
            color="warning"
            startIcon={<UndoIcon />}
            onClick={() => setConfirmOpen(true)}
            disabled={rollback.isPending}
          >
            Roll Back to Previous Revision
          </Button>
        </Box>
      ) : null}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Roll back?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            This re-publishes the previous revision and supersedes the current one.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={() => void handleRollback()}>
            Roll Back
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
