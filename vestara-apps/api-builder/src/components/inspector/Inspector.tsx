import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { ApiField } from '../../api/contracts';
import { useBuilder } from '../../context/BuilderContext';
import { FIELD_TYPES } from '../../types/domain';

export function Inspector() {
  const { definition, selectedResource, selectedField, updateField, setSelectedField } = useBuilder();

  if (!selectedResource) {
    return (
      <Box sx={{ borderLeft: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', p: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary' }}>
          Inspector
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
          Select a resource or field to edit it.
        </Typography>
      </Box>
    );
  }

  if (selectedField) {
    return <FieldInspector field={selectedField} onChange={(f) => void updateField(selectedResource.id, selectedField.id, f)} />;
  }

  return <ResourceInspector />;
}

function FieldInspector({ field, onChange }: { field: ApiField; onChange: (field: ApiField) => void }) {
  const [draft, setDraft] = useState<ApiField>(field);

  useEffect(() => setDraft(field), [field]);

  const set = (patch: Partial<ApiField>) => setDraft((d) => ({ ...d, ...patch }));

  const commit = () => {
    const next: ApiField = {
      id: field.id,
      name: draft.name.trim() || field.name,
      type: draft.type,
      ...(draft.required ? { required: true } : {}),
      ...(draft.unique ? { unique: true } : {}),
      ...(draft.indexed ? { indexed: true } : {}),
      ...(draft.enumValues && draft.enumValues.length > 0 ? { enumValues: draft.enumValues } : {}),
    };
    onChange(next);
  };

  return (
    <Box sx={{ borderLeft: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', p: 2, overflow: 'auto' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
        Field
      </Typography>
      <Stack spacing={2}>
        <TextField
          label="Name"
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          sx={{ fontFamily: 'monospace' }}
        />
        <TextField select label="Type" value={draft.type} onChange={(e) => set({ type: e.target.value })}>
          {FIELD_TYPES.map((t) => (
            <MenuItem key={t.value} value={t.value}>
              {t.label}
            </MenuItem>
          ))}
        </TextField>

        <Box>
          <FormControlLabel
            control={<Checkbox size="small" checked={draft.required ?? false} onChange={(e) => set({ required: e.target.checked })} />}
            label={<Typography variant="body2">Required</Typography>}
          />
          <FormControlLabel
            control={<Checkbox size="small" checked={draft.unique ?? false} onChange={(e) => set({ unique: e.target.checked })} />}
            label={<Typography variant="body2">Unique</Typography>}
          />
          <FormControlLabel
            control={<Checkbox size="small" checked={draft.indexed ?? false} onChange={(e) => set({ indexed: e.target.checked })} />}
            label={<Typography variant="body2">Indexed</Typography>}
          />
        </Box>

        {draft.type === 'enum' ? (
          <TextField
            label="Enum values"
            value={(draft.enumValues ?? []).join(', ')}
            onChange={(e) =>
              set({ enumValues: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })
            }
            helperText="Comma-separated"
          />
        ) : null}

        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={commit} disabled={!draft.name.trim()}>
            Save Field
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

function ResourceInspector() {
  const { selectedResource, renameResource, addField } = useBuilder();
  const [name, setName] = useState(selectedResource?.name ?? '');
  const [plural, setPlural] = useState(selectedResource?.plural ?? '');
  const [newFieldName, setNewFieldName] = useState('');

  useEffect(() => {
    setName(selectedResource?.name ?? '');
    setPlural(selectedResource?.plural ?? '');
  }, [selectedResource]);

  if (!selectedResource) return null;

  return (
    <Box sx={{ borderLeft: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', p: 2, overflow: 'auto' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
        Resource
      </Typography>
      <Stack spacing={2}>
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Plural" value={plural} onChange={(e) => setPlural(e.target.value)} placeholder="Automatic" />
        <Button
          variant="contained"
          onClick={() => void renameResource(selectedResource.id, name.trim() || selectedResource.name, plural.trim())}
          disabled={!name.trim()}
        >
          Save Resource
        </Button>
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 2 }}>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              label="Quick add field"
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newFieldName.trim()) {
                  void addField(selectedResource.id, newFieldName.trim(), 'string');
                  setNewFieldName('');
                }
              }}
            />
            <Button
              variant="outlined"
              onClick={() => {
                if (newFieldName.trim()) {
                  void addField(selectedResource.id, newFieldName.trim(), 'string');
                  setNewFieldName('');
                }
              }}
            >
              Add
            </Button>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
