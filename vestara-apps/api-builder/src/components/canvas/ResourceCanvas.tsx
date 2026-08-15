import { useState } from 'react';
import {
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
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import type { ApiResource } from '../../api/contracts';
import { useBuilder } from '../../context/BuilderContext';
import { fieldTypeLabel, pluralize } from '../../types/domain';
import { RelationDiagram } from './RelationDiagram';

const methodColor: Record<string, string> = {
  GET: '#4f8a5b',
  POST: '#5a7fb8',
  PUT: '#b8865a',
  PATCH: '#a05a9c',
  DELETE: '#b85a5a',
};

export function ResourceCanvas({ resource }: { resource: ApiResource | undefined }) {
  const { definition, addField, setSelectedResource, setSelectedField } = useBuilder();
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState('string');

  if (!resource) {
    const endpoints = definition?.endpoints ?? [];
    return (
      <Box sx={{ p: 4, overflow: 'auto' }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Overview
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          {definition?.name} · {definition?.namespace} · v{definition?.version}
        </Typography>
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary' }}>
              Resources
            </Typography>
            {definition?.resources.map((r) => (
              <Button key={r.id} sx={{ mr: 1, mb: 1 }} onClick={() => setSelectedResource(r.id)}>
                {r.name}
              </Button>
            ))}
            {definition?.resources.length === 0 ? (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                No resources. Select "Add Resource".
              </Typography>
            ) : null}
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary' }}>
              Generated Endpoints
            </Typography>
            {endpoints.length === 0 ? (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Endpoints are generated from resources.
              </Typography>
            ) : (
              endpoints.map((e) => (
                <Chip
                  key={e.id}
                  label={`${e.method} ${e.path}`}
                  size="small"
                  sx={{ mr: 1, mb: 1, bgcolor: methodColor[e.method] ?? '#555', color: '#fff', fontFamily: 'monospace' }}
                />
              ))
            )}
          </Box>
        </Stack>
      </Box>
    );
  }

  const handleAddField = async () => {
    if (!fieldName.trim()) return;
    await addField(resource.id, fieldName.trim(), fieldType);
    setFieldName('');
    setFieldType('string');
    setAddFieldOpen(false);
  };

  return (
    <Box sx={{ p: 3, overflow: 'auto' }}>
      <Stack direction="row" sx={{ alignItems: 'baseline' }} spacing={1}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {resource.name}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {resource.plural ?? pluralize(resource.name)}
        </Typography>
      </Stack>
      {resource.description ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
          {resource.description}
        </Typography>
      ) : null}

      <Box sx={{ mt: 2 }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary' }}>
            Fields
          </Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={() => setAddFieldOpen(true)}>
            Add Field
          </Button>
        </Stack>
        <Table size="small" sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Required</TableCell>
              <TableCell>Unique</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {resource.fields.map((field) => (
              <TableRow key={field.id} hover onClick={() => { setSelectedResource(resource.id); setSelectedField(field.id); }} sx={{ cursor: 'pointer' }}>
                <TableCell sx={{ fontFamily: 'monospace' }}>{field.name}</TableCell>
                <TableCell>{fieldTypeLabel(field.type)}</TableCell>
                <TableCell>{field.required ? '✓' : ''}</TableCell>
                <TableCell>{field.unique ? '✓' : ''}</TableCell>
              </TableRow>
            ))}
            {resource.fields.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} sx={{ color: 'text.secondary' }}>
                  No fields yet
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Box>

      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
          Relations
        </Typography>
        <RelationDiagram resource={resource} resources={definition?.resources ?? []} />
      </Box>

      <Dialog open={addFieldOpen} onClose={() => setAddFieldOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add Field to {resource.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              autoFocus
              label="Field name"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              placeholder="name"
            />
            <TextField
              select
              label="Type"
              value={fieldType}
              onChange={(e) => setFieldType(e.target.value)}
              slotProps={{ select: { native: true } }}
            >
              {['string', 'text', 'number', 'integer', 'boolean', 'uuid', 'email', 'url', 'date', 'date-time', 'json', 'enum', 'relation'].map((t) => (
                <option key={t} value={t}>
                  {fieldTypeLabel(t)}
                </option>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddFieldOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleAddField()} disabled={!fieldName.trim()}>
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
