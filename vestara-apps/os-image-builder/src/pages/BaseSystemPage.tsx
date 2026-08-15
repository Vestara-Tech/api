import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useImageBuilder } from '../context/ImageBuilderContext';

export function BaseSystemPage() {
  const { profile, patch } = useImageBuilder();
  const [draft, setDraft] = useState<{ distribution: string; release: string; kernel: string; architecture: string; version: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setDraft({
        distribution: profile.base.distribution,
        release: profile.base.release,
        kernel: profile.base.kernel,
        architecture: profile.architecture,
        version: profile.version,
      });
    }
  }, [profile]);

  if (!profile || !draft) return null;

  const save = async () => {
    await patch((d) => ({
      ...d,
      version: draft.version,
      architecture: draft.architecture as 'amd64' | 'arm64',
      base: {
        distribution: 'debian',
        release: draft.release,
        kernel: draft.kernel,
      },
    }));
  };

  return (
    <Box sx={{ p: 3, maxWidth: 720 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Base System
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        The foundation distribution, kernel and release the image is assembled from.
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        Profiles describe intent — the image builder compiles this into the base system at build time.
      </Alert>

      <Stack spacing={2} sx={{ maxWidth: 420 }}>
        <TextField
          label="Distribution"
          value={draft.distribution}
          onChange={(e) => setDraft({ ...draft, distribution: e.target.value })}
          disabled
          helperText="Currently Debian is the supported distribution."
        />
        <TextField
          label="Release"
          value={draft.release}
          onChange={(e) => setDraft({ ...draft, release: e.target.value })}
        />
        <TextField
          select
          label="Kernel"
          value={draft.kernel}
          onChange={(e) => setDraft({ ...draft, kernel: e.target.value })}
        >
          <MenuItem value="default">default (distribution kernel)</MenuItem>
          <MenuItem value="linux-image-amd64">linux-image-amd64</MenuItem>
          <MenuItem value="linux-image-arm64">linux-image-arm64</MenuItem>
        </TextField>
        <TextField
          select
          label="Architecture"
          value={draft.architecture}
          onChange={(e) => setDraft({ ...draft, architecture: e.target.value })}
        >
          <MenuItem value="amd64">amd64</MenuItem>
          <MenuItem value="arm64">arm64</MenuItem>
        </TextField>
        <TextField
          label="Version"
          value={draft.version}
          onChange={(e) => setDraft({ ...draft, version: e.target.value })}
        />
        <Box>
          <Button variant="contained" onClick={() => void save()}>
            Save Base System
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
