import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Alert, Box, Card, CardActionArea, CardContent, Chip, Grid, Stack, Typography } from '@mui/material';
import CategoryIcon from '@mui/icons-material/Category';
import { useContributions, useProvides } from '../hooks/useMarketplaceV2';

const KIND_GROUPS = [
  { label: 'AI & Agents', kinds: ['ai.model', 'ai.agent', 'ai.workflow', 'ai.evaluator', 'ai.role', 'ai.guardrail'] },
  { label: 'Builders & Generators', kinds: ['app.builder', 'app.generator', 'app.component', 'app.theme', 'app.template'] },
  { label: 'Integrations & Tools', kinds: ['integration', 'tool', 'workflow'] },
  { label: 'Platform & OS', kinds: ['platform.runtime', 'platform.os', 'image.profile', 'api.builder'] },
];

export function CategoriesPage() {
  const { data: contributions, isLoading, isError } = useContributions();
  const [activeKind, setActiveKind] = useState<string | null>(null);
  const { data: provided } = useProvides(activeKind ?? '');

  const stats = useMemo(() => {
    const byKind = new Map<string, number>();
    const byPackage = new Map<string, number>();
    for (const entry of contributions ?? []) {
      byPackage.set(entry.packageId, (byPackage.get(entry.packageId) ?? 0) + 1);
      for (const p of entry.manifest.provides) {
        byKind.set(p.kind, (byKind.get(p.kind) ?? 0) + 1);
      }
    }
    return { byKind, byPackage };
  }, [contributions]);

  const totalKinds = stats.byKind.size;
  const totalPackages = stats.byPackage.size;

  return (
    <Box sx={{ p: 3, maxWidth: 1100 }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 0.5 }}>
        <CategoryIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Categories</Typography>
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        The extended Vestara taxonomy — {totalKinds} capability kinds across {totalPackages} registered packages.
      </Typography>

      {isError ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Catalog unavailable — the API may be offline. Showing taxonomy groups only.
        </Alert>
      ) : null}
      {isLoading ? <Typography variant="body2" sx={{ color: 'text.secondary' }}>Loading catalog…</Typography> : null}

      {KIND_GROUPS.map((group) => (
        <Box key={group.label} sx={{ mb: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>{group.label}</Typography>
          <Grid container spacing={1}>
            {group.kinds.map((kind) => {
              const count = stats.byKind.get(kind) ?? 0;
              return (
                <Grid key={kind} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardActionArea onClick={() => setActiveKind(activeKind === kind ? null : kind)} sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography sx={{ fontWeight: 600 }}>{kind}</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {count} {count === 1 ? 'registration' : 'registrations'}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      ))}

      {activeKind !== null ? (
        <Box sx={{ mt: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 2 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2">Provides for</Typography>
            <Chip size="small" label={activeKind} color="info" onDelete={() => setActiveKind(null)} />
          </Stack>
          {provided && provided.length > 0 ? (
            <Stack spacing={0.5}>
              {provided.map((item) => (
                <Stack key={`${item.packageId}:${item.id}`} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Chip size="small" label={item.name} color="success" />
                  <Link to={`/marketplace/packages/${item.packageId}`} style={{ color: 'inherit', textDecoration: 'none', fontSize: 13, fontFamily: 'monospace' }}>
                    {item.packageId}
                  </Link>
                  {item.version !== undefined ? <Typography variant="caption" sx={{ color: 'text.secondary' }}>v{item.version}</Typography> : null}
                </Stack>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {isLoading ? 'Loading…' : 'No registrations for this kind yet.'}
            </Typography>
          )}
        </Box>
      ) : null}
    </Box>
  );
}
