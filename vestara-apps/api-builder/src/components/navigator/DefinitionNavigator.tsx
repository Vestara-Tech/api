import { useState } from 'react';
import { Link } from 'react-router';
import {
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import { useBuilder } from '../../context/BuilderContext';
import { pluralize } from '../../types/domain';

export function DefinitionNavigator() {
  const { definition, selectedResource, setSelectedResource, selectedField, setSelectedField, addResource, removeResource } =
    useBuilder();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (!definition) return null;

  const toggle = (resourceId: string) => {
    setExpanded((e) => ({ ...e, [resourceId]: !e[resourceId] }));
    setSelectedResource(resourceId);
    setSelectedField(null);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    await addResource(name.trim());
    setName('');
    setCreateOpen(false);
  };

  return (
    <Box sx={{ borderRight: '1px solid', borderColor: 'divider', overflow: 'auto', bgcolor: 'background.paper' }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary' }}>
          API Definition
        </Typography>
        <Link to={`/definitions/${definition.id}/preview`} style={{ fontSize: 12, color: '#8ab4ff' }}>
          Preview
        </Link>
      </Stack>

      <Box sx={{ px: 2, pb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 0.5 }}>
          Resources
        </Typography>
        <List dense disablePadding>
          {definition.resources.map((resource) => {
            const isExpanded = expanded[resource.id] ?? selectedResource?.id === resource.id;
            return (
              <Box key={resource.id}>
                <ListItemButton
                  dense
                  selected={selectedResource?.id === resource.id}
                  onClick={() => toggle(resource.id)}
                  sx={{ borderRadius: 1, pl: 1 }}
                >
                  <IconButton size="small" sx={{ p: 0, mr: 0.5 }} onClick={(e) => { e.stopPropagation(); toggle(resource.id); }}>
                    {isExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                  </IconButton>
                  <ListItemText
                    primary={resource.name}
                    secondary={resource.plural ?? pluralize(resource.name)}
                    slotProps={{ primary: { sx: { fontSize: 13 } }, secondary: { sx: { fontSize: 11 } } }}
                                      />
                  <ListItemSecondaryAction>
                    <IconButton
                      size="small"
                      edge="end"
                      onClick={(e) => { e.stopPropagation(); void removeResource(resource.id); }}
                    >
                      <DeleteOutlinedIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItemButton>
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <Box sx={{ pl: 4 }}>
                    {resource.fields.map((field) => (
                      <ListItemButton
                        key={field.id}
                        dense
                        selected={selectedField?.id === field.id}
                        onClick={() => { setSelectedResource(resource.id); setSelectedField(field.id); }}
                        sx={{ borderRadius: 1 }}
                      >
                        <ListItemText
                          primary={field.name}
                          secondary={field.type}
                          slotProps={{ primary: { sx: { fontSize: 12 } }, secondary: { sx: { fontSize: 11 } } }}
                                                  />
                      </ListItemButton>
                    ))}
                    {resource.fields.length === 0 ? (
                      <Typography variant="caption" sx={{ color: 'text.secondary', px: 1 }}>
                        No fields
                      </Typography>
                    ) : null}
                  </Box>
                </Collapse>
              </Box>
            );
          })}
          {definition.resources.length === 0 ? (
            <Typography variant="caption" sx={{ color: 'text.secondary', px: 1 }}>
              No resources yet
            </Typography>
          ) : null}
        </List>

        <Button size="small" fullWidth startIcon={<AddIcon />} onClick={() => setCreateOpen(true)} sx={{ mt: 1 }}>
          Add Resource
        </Button>
      </Box>

      <Box sx={{ px: 2, pb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 0.5 }}>
          Endpoints
        </Typography>
        {definition.endpoints.length === 0 ? (
          <Typography variant="caption" sx={{ color: 'text.secondary', px: 1 }}>
            Generated from resources
          </Typography>
        ) : null}
        {definition.endpoints.map((endpoint) => (
          <ListItemButton
            key={endpoint.id}
            dense
            component={Link}
            to={`/definitions/${definition.id}/endpoints/${endpoint.id}`}
            sx={{ borderRadius: 1, pl: 1 }}
          >
            <ListItemText
              primary={`${endpoint.method} ${endpoint.path}`}
              slotProps={{ primary: { sx: { fontSize: 12, fontFamily: 'monospace' } } }}
            />
          </ListItemButton>
        ))}
      </Box>

      <Box sx={{ px: 2, pb: 2 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'text.secondary'  }}>
          <ViewModuleIcon fontSize="small" />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>
            Policies · Operations · Events
          </Typography>
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.secondary', px: 1 }}>
          {definition.policies.length} policies · {definition.operations.length} operations · {definition.events.length} events
        </Typography>
      </Box>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add Resource</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Resource name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Products"
            fullWidth
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!name.trim()}>
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
