import { Box, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { PageContainer, StatusBadge, useVestaraThemeSnapshot } from '@vestara/ui';

import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { useAdminApiClient } from '../app/hooks/useAdminApiClient.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { formatInteger } from '../app/utils/format.js';

function definedTokenEntries(tokens: Record<string, string | undefined>): readonly [string, string][] {
  return Object.entries(tokens).filter((entry): entry is [string, string] => entry[1] !== undefined);
}

export function ThemesPage() {
  const client = useAdminApiClient();
  const themeSnapshot = useVestaraThemeSnapshot();

  const themes = useAsyncState((signal) => client.listThemes(signal), [client]);
  const templates = useAsyncState((signal) => client.listTemplates(signal), [client]);

  const templateThemeCounts = new Map<string, number>();
  for (const template of templates.data ?? []) {
    if (template.recommendedThemeId === undefined) continue;
    templateThemeCounts.set(template.recommendedThemeId, (templateThemeCounts.get(template.recommendedThemeId) ?? 0) + 1);
  }

  const activeTheme = themes.data?.find((theme) => theme.id === themeSnapshot.themeId) ?? themes.data?.[0];
  const activeThemeTokens = activeTheme ? definedTokenEntries(activeTheme.tokens) : [];
  const activeThemeUsage = activeTheme !== undefined ? templateThemeCounts.get(activeTheme.id) ?? 0 : 0;
  const currentThemeInCatalog = themes.data?.some((theme) => theme.id === themeSnapshot.themeId) ?? false;
  const totalTokenCount = themes.data?.reduce((count, theme) => count + definedTokenEntries(theme.tokens).length, 0);

  return (
    <PageContainer title="Themes" description="Theme catalog, compiled design tokens, and frontend snapshot alignment.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'System' }, { label: 'Themes' }]} />

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
          <MetricCard label="Themes" value={formatInteger(themes.data?.length)} detail="Registered themes" tone="healthy" />
          <MetricCard label="Tokens" value={formatInteger(totalTokenCount)} detail="Defined design tokens" tone="info" />
          <MetricCard label="Templates" value={formatInteger(templates.data?.length)} detail="Template records referencing themes" tone="warning" />
          <MetricCard label="Current theme" value={themeSnapshot.themeId} detail={themeSnapshot.source} tone={themeSnapshot.source === 'remote' ? 'healthy' : 'warning'} />
        </Box>

        <LoadableCard
          title="Theme catalog"
          description="Backend theme registry and token footprint."
          state={themes}
          tone="healthy"
          renderContent={(catalog) => (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Theme</TableCell>
                  <TableCell>Mode</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell>Tokens</TableCell>
                  <TableCell>Components</TableCell>
                  <TableCell>Template usage</TableCell>
                  <TableCell>Tags</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {catalog.map((theme) => (
                  <TableRow key={theme.id}>
                    <TableCell sx={{ fontWeight: 600 }}>
                      <Stack spacing={0.25}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {theme.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {theme.id}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <StatusBadge label={theme.mode} tone="neutral" />
                    </TableCell>
                    <TableCell>{theme.version}</TableCell>
                    <TableCell>{definedTokenEntries(theme.tokens).length}</TableCell>
                    <TableCell>{Object.keys(theme.components).length}</TableCell>
                    <TableCell>{templateThemeCounts.get(theme.id) ?? 0}</TableCell>
                    <TableCell>{theme.metadata.tags.length}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        />

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: '1fr',
              xl: 'repeat(2, minmax(0, 1fr))',
            },
          }}
        >
          <LoadableCard
            title="Active theme"
            description="Frontend provider snapshot cross-checked against the backend theme catalog."
            state={themes}
            tone={themeSnapshot.source === 'remote' ? 'healthy' : 'warning'}
            renderContent={(catalog) => {
              const current = catalog.find((theme) => theme.id === themeSnapshot.themeId) ?? catalog[0];
              if (current === undefined) return null;

              const tokens = definedTokenEntries(current.tokens);

              return (
                <Stack spacing={2}>
                  <KeyValueList
                    items={[
                      { label: 'Snapshot theme', value: themeSnapshot.themeId },
                      { label: 'Snapshot source', value: themeSnapshot.source },
                      { label: 'Snapshot status', value: themeSnapshot.status },
                      { label: 'Catalog match', value: currentThemeInCatalog ? 'Yes' : 'No' },
                      { label: 'Backend version', value: current.version },
                      { label: 'Template usage', value: formatInteger(templateThemeCounts.get(current.id) ?? 0) },
                    ]}
                  />

                  <Divider />

                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    <StatusBadge label={current.mode} tone="neutral" />
                    {current.metadata.tags.map((tag) => (
                      <StatusBadge key={tag} label={tag} tone="healthy" />
                    ))}
                  </Stack>

                  <Divider />

                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Token</TableCell>
                        <TableCell>Value</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tokens.slice(0, 10).map(([key, value]) => (
                        <TableRow key={key}>
                          <TableCell sx={{ fontWeight: 600 }}>{key}</TableCell>
                          <TableCell>{value}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Stack>
              );
            }}
          />

          <LoadableCard
            title="Theme anatomy"
            description="Typography, spacing, radius, motion, and assets."
            state={themes}
            tone="info"
            renderContent={(catalog) => {
              const current = catalog.find((theme) => theme.id === themeSnapshot.themeId) ?? catalog[0];
              if (current === undefined) return null;

              return (
                <Stack spacing={2}>
                  <KeyValueList
                    items={[
                      { label: 'Font family', value: current.typography.fontFamily },
                      { label: 'Base size', value: `${current.typography.baseSizePx}px` },
                      { label: 'Scale', value: current.typography.fontSizeScale.toString() },
                      { label: 'Spacing base', value: `${current.spacing.basePx}px` },
                      { label: 'Radius', value: `${current.radius.small}/${current.radius.medium}/${current.radius.large}/${current.radius.full}` },
                      { label: 'Motion', value: `${current.motion.durationFastMs} / ${current.motion.durationMediumMs} / ${current.motion.durationSlowMs}` },
                    ]}
                  />

                  <Divider />

                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    {current.elevation.levels.map((level) => (
                      <StatusBadge key={level} label={level} tone="neutral" />
                    ))}
                  </Stack>

                  <Divider />

                  <Stack spacing={0.5}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      Assets
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Logo: {current.assets.logo ?? '—'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Wallpaper: {current.assets.wallpaper ?? '—'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Splash: {current.assets.splash ?? '—'}
                    </Typography>
                  </Stack>
                </Stack>
              );
            }}
          />
        </Box>

        <LoadableCard
          title="Theme/template alignment"
          description="How templates point back to themes."
          state={templates}
          tone="warning"
          renderContent={(catalog) => (
            <Stack spacing={1.5}>
              <KeyValueList
                items={[
                  { label: 'Templates', value: formatInteger(catalog.length) },
                  { label: 'Templates with a theme', value: formatInteger(catalog.filter((template) => template.recommendedThemeId !== undefined).length) },
                ]}
              />
              <Divider />
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {catalog.slice(0, 16).map((template) => (
                  <StatusBadge
                    key={template.id}
                    label={`${template.id}:${template.recommendedThemeId ?? 'none'}`}
                    tone={template.recommendedThemeId !== undefined && themes.data?.some((theme) => theme.id === template.recommendedThemeId) ? 'healthy' : 'warning'}
                  />
                ))}
              </Stack>
            </Stack>
          )}
        />
      </Stack>
    </PageContainer>
  );
}
