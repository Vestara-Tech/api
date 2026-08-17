import { Box, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { PageContainer, StatusBadge, useVestaraThemeSnapshot } from '@vestara/ui';

import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { useWorkspaceApiClient } from '../app/hooks/useWorkspaceApiClient.js';
import { compactList, formatInteger } from '../app/utils/format.js';
import { summarizeThemes } from '../app/utils/summaries.js';

function modeTone(mode: string) {
  switch (mode) {
    case 'dark':
      return 'healthy' as const;
    case 'light':
      return 'info' as const;
    case 'system':
      return 'neutral' as const;
    default:
      return 'warning' as const;
  }
}

export function ThemesPage() {
  const client = useWorkspaceApiClient();
  const themeSnapshot = useVestaraThemeSnapshot();
  const themes = useAsyncState((signal) => client.listThemes(signal), [client]);
  const summary = summarizeThemes(themes.data ?? []);

  return (
    <PageContainer title="Themes" description="Theme catalog, token inventory, and frontend snapshot alignment.">
      <Stack spacing={2.5}>
        <PageBreadcrumbs
          items={[
            { label: 'Workspace', href: '/workspace/overview' },
            { label: 'System' },
            { label: 'Themes' },
          ]}
        />

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(4, minmax(0, 1fr))',
            },
          }}
        >
          <MetricCard label="Themes" value={formatInteger(summary.totalThemes)} detail="Theme catalog entries" />
          <MetricCard label="Dark" value={formatInteger(summary.darkThemes)} detail="Dark-mode themes" />
          <MetricCard label="Light" value={formatInteger(summary.lightThemes)} detail="Light-mode themes" />
          <MetricCard label="System" value={formatInteger(summary.systemThemes)} detail="System-aware themes" />
        </Box>

        <MetricCard label="Tokens" value={formatInteger(summary.totalTokens)} detail="Compiled token count across the catalog" />

        <LoadableCard
          title="Theme catalog"
          description="Catalog entries, mode, and token density."
          state={themes}
          renderContent={(data) => (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Version</TableCell>
                    <TableCell>Mode</TableCell>
                    <TableCell align="right">Tokens</TableCell>
                    <TableCell>Typography</TableCell>
                    <TableCell>Spacing</TableCell>
                    <TableCell>Motion</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.length > 0 ? (
                    data.map((theme) => (
                      <TableRow key={theme.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {theme.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {theme.id}
                          </Typography>
                        </TableCell>
                        <TableCell>{theme.version}</TableCell>
                        <TableCell>
                          <StatusBadge label={theme.mode} tone={modeTone(theme.mode)} />
                        </TableCell>
                        <TableCell align="right">{formatInteger(Object.keys(theme.tokens).length)}</TableCell>
                        <TableCell>{theme.typography.fontFamily}</TableCell>
                        <TableCell>{theme.spacing.basePx}px</TableCell>
                        <TableCell>{theme.motion.easing}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Typography variant="body2" color="text.secondary">
                          No themes have been registered yet.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          )}
        />

        <LoadableCard
          title="Selected theme"
          description="Token and metadata details for the first theme definition."
          state={themes}
          renderContent={(data) => {
            const theme = data[0];

            if (theme === undefined) {
              return (
                <Typography variant="body2" color="text.secondary">
                  No theme details available.
                </Typography>
              );
            }

            return (
              <Stack spacing={1.5}>
                <KeyValueList
                  items={[
                    { label: 'Name', value: theme.name },
                    { label: 'Identifier', value: theme.id },
                    { label: 'Version', value: theme.version },
                    { label: 'Mode', value: <StatusBadge label={theme.mode} tone={modeTone(theme.mode)} /> },
                    { label: 'Metadata mode', value: theme.metadata.mode },
                    { label: 'Author', value: theme.metadata.author ?? '—' },
                    { label: 'Description', value: theme.metadata.description ?? '—' },
                    { label: 'Tags', value: compactList(theme.metadata.tags) },
                    { label: 'Brand primary', value: theme.tokens['color.brand.primary'] ?? theme.tokens['accent.primary'] ?? '—' },
                    { label: 'Typography family', value: theme.typography.fontFamily },
                    { label: 'Base size', value: `${theme.typography.baseSizePx}px` },
                    { label: 'Spacing base', value: `${theme.spacing.basePx}px` },
                    { label: 'Radius medium', value: `${theme.radius.medium}px` },
                    { label: 'Elevation levels', value: formatInteger(theme.elevation.levels.length) },
                  ]}
                />

                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    Frontend snapshot
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Source: {themeSnapshot.source}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Theme id: {themeSnapshot.themeId}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Hydration: {themeSnapshot.status}
                  </Typography>
                </Box>
              </Stack>
            );
          }}
        />
      </Stack>
    </PageContainer>
  );
}
