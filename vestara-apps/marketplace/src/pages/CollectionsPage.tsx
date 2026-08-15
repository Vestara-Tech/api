import { useState } from 'react';
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useCollections } from '../hooks/useCollections';

export function CollectionsPage() {
  const { collections, createCollection, togglePackage, removeCollection } = useCollections();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [draft, setDraft] = useState<string[]>([]);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);

  const handleCreate = () => {
    if (!name.trim()) return;
    const collection = createCollection(name.trim());
    for (const packageId of draft) togglePackage(collection.id, packageId);
    setName('');
    setDraft([]);
    setOpen(false);
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800 }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Collections</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Group packages into reusable bundles (e.g. "Full-Stack Pack", "QA Tooling").
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>New Collection</Button>
      </Stack>

      <Stack spacing={1.5}>
        {collections.map((collection) => (
          <Box key={collection.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 1.5 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography sx={{ fontWeight: 600 }}>{collection.name}</Typography>
              <Chip size="small" label={`${collection.packageIds.length} packages`} variant="outlined" />
              <Box sx={{ flex: 1 }} />
              <Button size="small" color="error" onClick={() => removeCollection(collection.id)}>Remove</Button>
            </Stack>
            <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', mt: 1 }}>
              {collection.packageIds.map((id) => (
                <Chip key={id} size="small" label={id} onDelete={() => togglePackage(collection.id, id)} />
              ))}
              {collection.packageIds.length === 0 ? <Typography variant="caption" sx={{ color: 'text.secondary' }}>Empty — add packages via the collection dialog.</Typography> : null}
            </Stack>
          </Box>
        ))}
        {collections.length === 0 ? <Typography variant="body2" sx={{ color: 'text.secondary' }}>No collections yet.</Typography> : null}
      </Stack>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New Collection</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField autoFocus label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full-Stack Pack" />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Optionally start with package ids (comma-separated).
            </Typography>
            <TextField
              label="Package ids"
              value={draft.join(', ')}
              onChange={(e) => setDraft(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
              placeholder="com.vestara.developer-agent, com.vestara.git-tools"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!name.trim()}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
