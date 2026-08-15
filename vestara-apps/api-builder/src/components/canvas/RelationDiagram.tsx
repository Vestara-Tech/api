import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import type { ApiResource } from '../../api/contracts';
import { useBuilder } from '../../context/BuilderContext';
import { pluralize } from '../../types/domain';

const kindLabels: Record<string, string> = {
  'one-to-one': '1 : 1',
  'one-to-many': '1 : N',
  'many-to-one': 'N : 1',
  'many-to-many': 'N : N',
};

export function RelationDiagram({
  resource,
  resources,
}: {
  resource: ApiResource;
  resources: readonly ApiResource[];
}) {
  const { addRelation, removeRelation } = useBuilder();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; kind: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many'; targetResource: string }>({ name: '', kind: 'many-to-one', targetResource: '' });

  const outgoing = resource.relations ?? [];
  const incoming = resources.filter((r) => (r.relations ?? []).some((rel) => rel.targetResource === resource.name));

  const handleAdd = async () => {
    if (!form.name.trim() || !form.targetResource) return;
    await addRelation(resource.id, {
      name: form.name.trim(),
      kind: form.kind,
      targetResource: form.targetResource,
      ...(form.kind === 'many-to-one' ? { foreignKey: `${form.name.trim()}Id` } : {}),
    });
    setForm({ name: '', kind: 'many-to-one', targetResource: '' });
    setOpen(false);
  };

  const targetName = (name: string) => resources.find((r) => r.name === name)?.name ?? name;

  return (
    <Box>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {incoming.map((r) => {
          const rel = (r.relations ?? []).find((x) => x.targetResource === resource.name);
          return (
            <Box
              key={r.id}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 1.5, minWidth: 180 }}
            >
              <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{r.name}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {pluralize(r.name)}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1  }}>
                <Chip size="small" label={rel ? kindLabels[rel.kind] ?? rel.kind : '→'} sx={{ fontFamily: 'monospace' }} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  → {resource.name}
                </Typography>
              </Stack>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                {rel?.name ?? ''} {rel?.foreignKey ? `(${rel.foreignKey})` : ''}
              </Typography>
            </Box>
          );
        })}

        {outgoing.map((rel) => (
          <Box
            key={rel.id}
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 1.5, minWidth: 180 }}
          >
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{resource.name}</Typography>
              <IconButton size="small" onClick={() => void removeRelation(resource.id, rel.id)}>
                <DeleteOutlinedIcon fontSize="small" />
              </IconButton>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1  }}>
              <Chip size="small" label={kindLabels[rel.kind] ?? rel.kind} sx={{ fontFamily: 'monospace' }} />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                → {targetName(rel.targetResource)}
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
              {rel.name} {rel.foreignKey ? `(${rel.foreignKey})` : ''}
            </Typography>
          </Box>
        ))}
      </Stack>

      <Button size="small" startIcon={<AddIcon />} onClick={() => setOpen(true)} sx={{ mt: 1 }}>
        Add Relation
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New Relation</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Relation name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="category"
            />
            <TextField
              select
              label="Type"
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many' })}
            >
              {Object.entries(kindLabels).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label} · {value.replaceAll('-', ' ')}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Target resource"
              value={form.targetResource}
              onChange={(e) => setForm({ ...form, targetResource: e.target.value })}
            >
              {resources
                .filter((r) => r.id !== resource.id)
                .map((r) => (
                  <MenuItem key={r.id} value={r.name}>
                    {r.name}
                  </MenuItem>
                ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd} disabled={!form.name.trim() || !form.targetResource}>
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
