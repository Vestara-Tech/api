import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { useImageBuilder } from '../context/ImageBuilderContext';

const SUGGESTED = ['git', 'curl', 'vim', 'htop', 'build-essential', 'openssh-server', 'ufw'];

export function PackagesPage() {
  const { profile, patch } = useImageBuilder();
  const [input, setInput] = useState('');

  if (!profile) return null;

  const packages = profile.packages.extraPackages;

  const add = async (pkg: string) => {
    const name = pkg.trim().replace(/^\s+|\s+$/g, '');
    if (!name || packages.includes(name)) return;
    await patch((d) => ({
      ...d,
      packages: { ...d.packages, extraPackages: [...d.packages.extraPackages, name] },
    }));
    setInput('');
  };

  const remove = async (pkg: string) => {
    await patch((d) => ({
      ...d,
      packages: { ...d.packages, extraPackages: d.packages.extraPackages.filter((p) => p !== pkg) },
    }));
  };

  return (
    <Box sx={{ p: 3, maxWidth: 720 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Packages
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Extra packages installed on top of the base system. The base set is resolved from the
        profile at build time.
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 2, maxWidth: 480 }}>
        <TextField
          label="Package name"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add(input); }}
          fullWidth
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => void add(input)} disabled={!input.trim()}>
          Add
        </Button>
      </Stack>

      <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', mb: 2 }}>
        {SUGGESTED.filter((s) => !packages.includes(s)).map((s) => (
          <Chip key={s} size="small" label={`+ ${s}`} variant="outlined" onClick={() => void add(s)} clickable />
        ))}
      </Stack>

      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
        Selected ({packages.length})
      </Typography>
      {packages.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No extra packages.
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          {packages.map((pkg) => (
            <Stack key={pkg} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography sx={{ fontFamily: 'monospace', fontSize: 14 }}>{pkg}</Typography>
              <IconButton size="small" onClick={() => void remove(pkg)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );
}
