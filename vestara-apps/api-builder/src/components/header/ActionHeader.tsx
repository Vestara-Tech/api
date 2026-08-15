import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Chip,
  Snackbar,
  Stack,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import type { ApiDefinition } from '../../api/contracts';
import { usePublish, useValidate } from '../../hooks/useBuilder';
import { DEFINITION_STATUSES } from '../../types/domain';

const chipTone: Record<string, 'default' | 'primary' | 'success' | 'info' | 'secondary' | 'warning'> = {
  draft: 'default',
  validating: 'info',
  ready: 'success',
  publishing: 'info',
  published: 'success',
  superseded: 'secondary',
};

export function ActionHeader({ definition, onToggleAssistant, assistantOpen }: { definition: ApiDefinition; onToggleAssistant: () => void; assistantOpen: boolean }) {
  const validate = useValidate(definition.id);
  const publish = usePublish(definition.id);
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const status = DEFINITION_STATUSES.find((s) => s.value === definition.status);

  const handleValidate = async () => {
    const result = await validate.mutateAsync();
    if (result.ok) setNotice('Definition is valid and ready.');
    else {
      const errors = result.issues.filter((i) => i.severity === 'error').length;
      const warnings = result.issues.length - errors;
      setNotice(`Validation failed: ${errors} errors, ${warnings} warnings.`);
    }
  };

  const handlePublish = async () => {
    setConfirmOpen(false);
    try {
      await publish.mutateAsync();
      setNotice(`Published as revision ${definition.revision + 1}.`);
    } catch (err) {
      setNotice(`Publish failed: ${(err as Error).message}`);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
          {definition.name}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {definition.namespace} · v{definition.version} · revision {definition.revision}
        </Typography>
      </Box>

      <Chip
        label={status?.label ?? definition.status}
        color={chipTone[definition.status] ?? 'default'}
        size="small"
      />

      <Box sx={{ flex: 1 }} />

      <Button
        size="small"
        variant="outlined"
        startIcon={<PlayArrowIcon />}
        onClick={handleValidate}
        disabled={validate.isPending}
      >
        Validate
      </Button>
      <Button
        size="small"
        variant="outlined"
        component={Link}
        to={`/definitions/${definition.id}/preview`}
        startIcon={<FactCheckIcon />}
      >
        Preview
      </Button>
      <Button
        size="small"
        variant="contained"
        startIcon={<RocketLaunchIcon />}
        onClick={() => setConfirmOpen(true)}
        disabled={publish.isPending}
      >
        Publish
      </Button>

      <Button
        size="small"
        variant="outlined"
        onClick={onToggleAssistant}
        startIcon={<AutoAwesomeIcon />}
        color={assistantOpen ? 'primary' : 'inherit'}
      >
        Assistant
      </Button>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Publish {definition.name}?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            This validates the definition and records it as revision {definition.revision + 1}.
            Published definitions are immutable.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handlePublish} disabled={publish.isPending}>
            Publish Anyway
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={notice !== null}
        autoHideDuration={4000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="info" variant="filled" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      </Snackbar>
    </Box>
  );
}
