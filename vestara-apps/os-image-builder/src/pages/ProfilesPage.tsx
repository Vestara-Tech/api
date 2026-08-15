import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import StorageIcon from '@mui/icons-material/Storage';
import { useProfiles, useRegisterProfile } from '../hooks/useImage';
import { useConnection } from '../hooks/useConnection';
import { BuilderDiagnostics } from '../components/connectivity/BuilderDiagnostics';
import { apiBase, imageClient } from '../api/client';
import { PRESETS, applicationsSizeMb } from '../types/domain';

export function ProfilesPage() {
  const { data: profiles, isLoading, isError, error } = useProfiles();
  const register = useRegisterProfile();
  const navigate = useNavigate();
  const [creating, setCreating] = useState<string | null>(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const { state, retry } = useConnection(imageClient, ['image']);

  const existing = new Set((profiles ?? []).map((p) => p.id));

  const createFromPreset = async (presetId: string) => {
    setCreating(presetId);
    const preset = PRESETS.find((p) => p.id === presetId)!;
    const profile = await register.mutateAsync({
      ...preset.base,
      profileHash: '',
    } as never);
    navigate(`/os-image-builder/${profile.id}`);
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1100 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Image Profiles
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Design, validate, build, boot-test and publish Vestara OS images.
          </Typography>
        </Box>
      </Stack>

      {isError ? (
        <Alert severity="error" sx={{ mb: 2 }} action={
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <Button color="inherit" size="small" onClick={() => setDiagnosticsOpen(true)}>
              Diagnostics
            </Button>
            <Button color="inherit" size="small" onClick={retry}>
              Retry
            </Button>
          </Stack>
        }>
          {state.status === 'offline'
            ? `Cannot reach the Vestara API at ${apiBase}.`
            : state.status === 'contract-mismatch'
              ? 'API contract mismatch — the API version does not match this builder.'
              : state.status === 'degraded'
                ? 'API reached, but the image-builder capability is not available.'
                : `Failed to load profiles: ${error instanceof Error ? error.message : 'unknown error'}`}
        </Alert>
      ) : null}
      <BuilderDiagnostics open={diagnosticsOpen} onClose={() => setDiagnosticsOpen(false)} />

      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
        Start from a preset
      </Typography>
      <Grid container spacing={1.5} sx={{ mb: 3 }}>
        {PRESETS.map((preset) => {
          const apps = preset.base.applications?.applications ?? [];
          const footprintMb = applicationsSizeMb(apps);
          const isRegistered = existing.has(preset.id);
          return (
            <Grid key={preset.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardActionArea
                  onClick={() => void createFromPreset(preset.id)}
                  disabled={creating === preset.id}
                  sx={{ height: '100%' }}
                >
                  <CardContent>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <StorageIcon sx={{ color: 'primary.main' }} fontSize="small" />
                      <Typography sx={{ fontWeight: 600 }}>{preset.name}</Typography>
                      {isRegistered ? <Chip size="small" label="existing" color="info" /> : null}
                    </Stack>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, mb: 1 }}>
                      {preset.description}
                    </Typography>
                    <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      <Chip size="small" label={`${apps.length} apps`} />
                      <Chip size="small" label={`${footprintMb} MB`} />
                      <Chip size="small" label={(preset.base.architecture as string).toUpperCase()} variant="outlined" />
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          );
          })}
      </Grid>

      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
        Registered profiles
      </Typography>
      {isLoading ? <Typography sx={{ color: 'text.secondary' }}>Loading…</Typography> : null}
      {(profiles ?? []).map((profile) => (
        <Card key={profile.id} variant="outlined" sx={{ mb: 1 }}>
          <CardActionArea component={Link} to={`/os-image-builder/${profile.id}`}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 }}}>
              <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography sx={{ fontWeight: 600, fontFamily: 'monospace' }}>{profile.id}</Typography>
                <Chip size="small" label={`v${profile.version}`} variant="outlined" />
                <Chip size="small" label={profile.architecture.toUpperCase()} variant="outlined" />
                <Chip size="small" label={`${profile.applications.applications.length} apps`} />
                <Box sx={{ flex: 1 }} />
                <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                  {profile.profileHash.slice(0, 10)}…
                </Typography>
              </Stack>
            </CardContent>
          </CardActionArea>
        </Card>
      ))}
      {profiles && profiles.length === 0 && !isLoading ? (
        <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="body2">No profiles yet. Start from a preset above.</Typography>
        </Box>
      ) : null}

      <Button startIcon={<AddIcon />} sx={{ mt: 2 }} onClick={() => void createFromPreset('custom')}>
        Add blank custom profile
      </Button>
    </Box>
  );
}
