import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useCreateDefinition, useDefinitionsList } from '../hooks/useBuilder';
import { DEFINITION_STATUSES, type ApiDefinitionStatus } from '../types/domain';

const statusTone: Record<ApiDefinitionStatus, string> = {
  draft: 'default',
  validating: 'info',
  ready: 'success',
  publishing: 'info',
  published: 'success',
  superseded: 'secondary',
} as const;

export function DefinitionsPage() {
  const { data, isLoading, isError } = useDefinitionsList();
  const create = useCreateDefinition();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', namespace: '', version: '0.1.0', description: '' });

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    const created = await create.mutateAsync({
      name: form.name.trim(),
      namespace: form.namespace.trim() || 'default',
      version: form.version.trim() || '0.1.0',
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
    });
    setOpen(false);
    setForm({ name: '', namespace: '', version: '0.1.0', description: '' });
    navigate(`/definitions/${created.id}`);
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1100 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            API Definitions
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Design, validate, and publish typed API contracts.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          New Definition
        </Button>
      </Stack>

      {isError ? (
        <Alert severity="error">Failed to load definitions. Is the API running on port 3001?</Alert>
      ) : null}

      {isLoading ? <Typography sx={{ color: 'text.secondary', py: 4 }}>Loading…</Typography> : null}

      <List sx={{ bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
        {(data?.items ?? []).map((def) => {
          const status = DEFINITION_STATUSES.find((s) => s.value === def.status);
          return (
            <ListItemButton
              key={def.id}
              component={Link}
              to={`/definitions/${def.id}`}
              sx={{ borderBottom: '1px solid', borderColor: 'divider', ':last-child': { borderBottom: 'none' } }}
            >
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Typography sx={{ fontWeight: 600 }}>{def.name}</Typography>
                    <Chip
                      label={status?.label ?? def.status}
                      color={(statusTone[def.status as ApiDefinitionStatus] as 'success' | 'default' | 'info' | 'secondary') ?? 'default'}
                      size="small"
                    />
                    <Chip label={`rev ${def.revision}`} size="small" variant="outlined" />
                  </Stack>
                }
                secondary={`${def.namespace} · v${def.version} · ${def.resources.length} resources · ${def.endpoints.length} endpoints · ${def.metadata.updatedAt}`}
              />
            </ListItemButton>
          );
        })}
        {data && data.items.length === 0 && !isLoading ? (
          <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
            <Typography>No definitions yet. Create your first API definition.</Typography>
          </Box>
        ) : null}
      </List>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New API Definition</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Commerce API"
              required
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Namespace"
                value={form.namespace}
                onChange={(e) => setForm({ ...form, namespace: e.target.value })}
                placeholder="default"
                sx={{ flex: 1 }}
              />
              <TextField
                label="Version"
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                sx={{ width: 140 }}
              />
            </Stack>
            <TextField
              label="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              multiline
              minRows={2}
            />
            {create.isError ? <Alert severity="error">{(create.error as Error).message}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!form.name.trim() || create.isPending}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
