import { useEffect, useState } from 'react';
import { Alert, Box, Chip, Grid, Stack, TextField, Typography } from '@mui/material';
import { marketplaceApi, type PackageView } from '../api/marketplaceApi';
import { PackageCard } from '../components/package/PackageCard';

export function DiscoverPage() {
  const [packages, setPackages] = useState<readonly PackageView[]>([]);
  const [categories, setCategories] = useState<readonly { name: string; count: number }[]>([]);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<string | undefined>(undefined);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    void marketplaceApi.packages(search || undefined, kind).then(setPackages).catch(() => setOffline(true));
  }, [search, kind]);

  useEffect(() => {
    void marketplaceApi.categories().then(setCategories).catch(() => undefined);
  }, []);

  return (
    <Box sx={{ p: 3, maxWidth: 1100 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Build more with Vestara
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        The distribution surface for Vestara capabilities — agents, skills, tools,
        workflows, integrations, generators and more.
      </Typography>

      {offline ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Offline — showing locally available Vestara packages and cached catalog metadata.
        </Alert>
      ) : null}

      <TextField
        size="small"
        label="Search packages"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2, maxWidth: 420 }}
        fullWidth
      />

      <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', mb: 3 }}>
        <Chip size="small" label="All" variant={kind === undefined ? 'filled' : 'outlined'} color={kind === undefined ? 'primary' : 'default'} onClick={() => setKind(undefined)} clickable />
        {categories.map((c) => (
          <Chip key={c.name} size="small" label={`${c.name} (${c.count})`} variant={kind === c.name ? 'filled' : 'outlined'} color={kind === c.name ? 'primary' : 'default'} onClick={() => setKind(kind === c.name ? undefined : c.name)} clickable />
        ))}
      </Stack>

      <Grid container spacing={1.5}>
        {packages.map((pkg) => (
          <Grid key={pkg.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <PackageCard pkg={pkg} />
          </Grid>
        ))}
        {packages.length === 0 ? <Typography sx={{ color: 'text.secondary', p: 2 }}>No packages match.</Typography> : null}
      </Grid>
    </Box>
  );
}
