import { useCallback, useEffect, useState } from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import { marketplaceApi, type InstalledView, type PackageView } from '../api/marketplaceApi';
import { PackageCard } from '../components/package/PackageCard';

const FAVORITES_KEY = 'vestara.marketplace.favorites';

function readFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

export function MyLibraryPage() {
  const [installed, setInstalled] = useState<readonly InstalledView[]>([]);
  const [favorites, setFavorites] = useState<string[]>(readFavorites());
  const [favoritePackages, setFavoritePackages] = useState<readonly PackageView[]>([]);

  const loadInstalled = useCallback(() => {
    void marketplaceApi.installed().then(setInstalled).catch(() => undefined);
  }, []);

  useEffect(() => {
    loadInstalled();
  }, [loadInstalled]);

  useEffect(() => {
    if (favorites.length === 0) {
      setFavoritePackages([]);
      return;
    }
    void marketplaceApi.packages().then((all) => setFavoritePackages(all.filter((p) => favorites.includes(p.id)))).catch(() => undefined);
  }, [favorites]);

  const toggleFavorite = (id: string): void => {
    const next = favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id];
    setFavorites(next);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1000 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        My Library
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Installed, purchased, created, favorites and updates — the operational
        view of what belongs to you.
      </Typography>

      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
        Installed ({installed.length})
      </Typography>
      <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', mb: 3 }}>
        {installed.map((item) => (
          <Chip key={item.packageId} size="small" label={`${item.packageId} v${item.version}`} color={item.enabled ? 'success' : 'default'} variant="outlined" />
        ))}
        {installed.length === 0 ? <Typography variant="caption" sx={{ color: 'text.secondary' }}>Nothing installed yet.</Typography> : null}
      </Stack>

      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
        Favorites ({favoritePackages.length})
      </Typography>
      <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', mb: 3 }}>
        {favorites.map((id) => (
          <Chip
            key={id}
            size="small"
            label={id}
            onDelete={() => toggleFavorite(id)}
            deleteIcon={<StarIcon fontSize="small" sx={{ color: 'warning.main' }} />}
          />
        ))}
        {favorites.length === 0 ? <Typography variant="caption" sx={{ color: 'text.secondary' }}>Star packages to keep them here.</Typography> : null}
      </Stack>

      <Stack spacing={1.5}>
        {favoritePackages.map((pkg) => (
          <Stack key={pkg.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Box sx={{ flex: 1 }}><PackageCard pkg={pkg} /></Box>
            <Chip size="small" label="★" onDelete={() => toggleFavorite(pkg.id)} />
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
