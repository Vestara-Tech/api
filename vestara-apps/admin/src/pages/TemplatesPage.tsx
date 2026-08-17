import { Box, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { PageContainer, StatusBadge } from '@vestara/ui';

import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { useAdminApiClient } from '../app/hooks/useAdminApiClient.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { compactList, formatInteger } from '../app/utils/format.js';

function templateParameterSummary(parameters: readonly { readonly name: string; readonly type: string; readonly required?: boolean; readonly defaultValue?: unknown }[]): string {
  return compactList(parameters.slice(0, 3).map((parameter) => `${parameter.name}:${parameter.type}${parameter.required === true ? '*' : ''}`));
}

export function TemplatesPage() {
  const client = useAdminApiClient();

  const templates = useAsyncState((signal) => client.listTemplates(signal), [client]);
  const kinds = useAsyncState((signal) => client.listTemplateKinds(signal), [client]);
  const themes = useAsyncState((signal) => client.listThemes(signal), [client]);

  const themeIds = new Set(themes.data?.map((theme) => theme.id) ?? []);
  const themedTemplates = templates.data?.filter((template) => template.recommendedThemeId !== undefined).length;
  const alignedTemplates = templates.data?.filter((template) => template.recommendedThemeId !== undefined && themeIds.has(template.recommendedThemeId)).length;
  const missingThemeTemplates = templates.data?.filter((template) => template.recommendedThemeId !== undefined && !themeIds.has(template.recommendedThemeId)).length;
  const totalParameters = templates.data?.reduce((count, template) => count + template.parameters.length, 0);

  return (
    <PageContainer title="Templates" description="Template registry, kinds, and theme alignment.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Build' }, { label: 'Templates' }]} />

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
          <MetricCard label="Templates" value={formatInteger(templates.data?.length)} detail="Registered templates" tone="healthy" />
          <MetricCard label="Kinds" value={formatInteger(kinds.data?.length)} detail="Template kinds" tone="info" />
          <MetricCard label="Theme-linked" value={formatInteger(themedTemplates)} detail="Templates with a recommended theme" tone="warning" />
          <MetricCard label="Parameters" value={formatInteger(totalParameters)} detail="Declared template parameters" tone="neutral" />
        </Box>

        <LoadableCard
          title="Template registry"
          description="Templates and their theme/capability requirements."
          state={templates}
          tone="healthy"
          renderContent={(catalog) => (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Template</TableCell>
                  <TableCell>Kind</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell>Theme</TableCell>
                  <TableCell>Parameters</TableCell>
                  <TableCell>Capabilities</TableCell>
                  <TableCell>Tags</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {catalog.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell sx={{ fontWeight: 600 }}>
                      <Stack spacing={0.25}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {template.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {template.id}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{template.kind}</TableCell>
                    <TableCell>{template.version}</TableCell>
                    <TableCell>
                      <StatusBadge label={template.recommendedThemeId ?? '—'} tone={template.recommendedThemeId !== undefined && themeIds.has(template.recommendedThemeId) ? 'healthy' : 'warning'} />
                    </TableCell>
                    <TableCell>{template.parameters.length}</TableCell>
                    <TableCell>{template.requiredCapabilities.length}</TableCell>
                    <TableCell>{template.tags.length}</TableCell>
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
            title="Template details"
            description="Selected template details and its parameter footprint."
            state={templates}
            tone="info"
            renderContent={(catalog) => {
              const template = catalog[0];
              if (template === undefined) return null;

              return (
                <Stack spacing={2}>
                  <KeyValueList
                    items={[
                      { label: 'Name', value: template.name },
                      { label: 'Kind', value: template.kind },
                      { label: 'Version', value: template.version },
                      { label: 'Recommended theme', value: template.recommendedThemeId ?? '—' },
                      { label: 'Required capabilities', value: formatInteger(template.requiredCapabilities.length) },
                      { label: 'Parameter summary', value: templateParameterSummary(template.parameters) },
                    ]}
                  />

                  <Divider />

                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    {template.tags.map((tag) => (
                      <StatusBadge key={tag} label={tag} tone="neutral" />
                    ))}
                    {template.requiredCapabilities.map((capability) => (
                      <StatusBadge key={capability} label={capability} tone="warning" />
                    ))}
                  </Stack>

                  <Divider />

                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Parameter</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Required</TableCell>
                        <TableCell>Default</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {template.parameters.map((parameter) => (
                        <TableRow key={parameter.name}>
                          <TableCell sx={{ fontWeight: 600 }}>{parameter.name}</TableCell>
                          <TableCell>{parameter.type}</TableCell>
                          <TableCell>{parameter.required === true ? 'Yes' : 'No'}</TableCell>
                          <TableCell>{parameter.defaultValue === undefined ? '—' : String(parameter.defaultValue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Stack>
              );
            }}
          />

          <LoadableCard
            title="Kind coverage"
            description="Template kinds and adoption footprint."
            state={kinds}
            tone="warning"
            renderContent={(catalog) => (
              <Stack spacing={1.5}>
                <KeyValueList items={[{ label: 'Kinds', value: formatInteger(catalog.length) }]} />
                <Divider />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {catalog.map((kind) => (
                    <StatusBadge key={kind} label={kind} tone="neutral" />
                  ))}
                </Stack>
              </Stack>
            )}
          />

          <LoadableCard
            title="Theme alignment"
            description="Template recommendations validated against the current theme catalog."
            state={templates}
            tone="healthy"
            renderContent={(catalog) => (
              <Stack spacing={1.5}>
                <KeyValueList
                  items={[
                    { label: 'Recommended', value: formatInteger(themedTemplates) },
                    { label: 'Aligned', value: formatInteger(alignedTemplates) },
                    { label: 'Missing theme', value: formatInteger(missingThemeTemplates) },
                  ]}
                />
                <Divider />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {catalog.slice(0, 16).map((template) => (
                    <StatusBadge
                      key={template.id}
                      label={`${template.id}:${template.recommendedThemeId ?? 'none'}`}
                      tone={template.recommendedThemeId !== undefined && themeIds.has(template.recommendedThemeId) ? 'healthy' : 'warning'}
                    />
                  ))}
                </Stack>
              </Stack>
            )}
          />

          <LoadableCard
            title="Theme inventory"
            description="Themes available for template recommendations."
            state={themes}
            tone="info"
            renderContent={(catalog) => (
              <Stack spacing={1.5}>
                <KeyValueList items={[{ label: 'Themes', value: formatInteger(catalog.length) }]} />
                <Divider />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {catalog.map((theme) => (
                    <StatusBadge key={theme.id} label={theme.id} tone="neutral" />
                  ))}
                </Stack>
              </Stack>
            )}
          />
        </Box>
      </Stack>
    </PageContainer>
  );
}
