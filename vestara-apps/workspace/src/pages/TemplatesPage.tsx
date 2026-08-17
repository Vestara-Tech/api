import { Box, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { PageContainer, StatusBadge, type StatusTone } from '@vestara/ui';

import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { useWorkspaceApiClient } from '../app/hooks/useWorkspaceApiClient.js';
import { compactList, formatInteger, formatUnknownValue } from '../app/utils/format.js';
import { summarizeTemplates } from '../app/utils/summaries.js';

function themeTone(themeId?: string): StatusTone {
  return themeId !== undefined ? 'healthy' : 'neutral';
}

export function TemplatesPage() {
  const client = useWorkspaceApiClient();
  const templates = useAsyncState((signal) => client.listTemplates(signal), [client]);
  const kinds = useAsyncState((signal) => client.listTemplateKinds(signal), [client]);
  const summary = summarizeTemplates(templates.data ?? []);

  return (
    <PageContainer title="Templates" description="Template registry, kinds, parameter contracts, and theme alignment.">
      <Stack spacing={2.5}>
        <PageBreadcrumbs
          items={[
            { label: 'Workspace', href: '/workspace/overview' },
            { label: 'Compose' },
            { label: 'Templates' },
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
          <MetricCard label="Templates" value={formatInteger(summary.totalTemplates)} detail="Composable blueprint records" />
          <MetricCard label="Kinds" value={formatInteger(kinds.data?.length)} detail="Template kind catalog" />
          <MetricCard label="Theme-linked" value={formatInteger(summary.themedTemplates)} detail="Templates with a recommended theme" />
          <MetricCard label="Capabilities" value={formatInteger(summary.uniqueRequiredCapabilities)} detail="Unique required capabilities" />
        </Box>

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, minmax(0, 1fr))',
            },
          }}
        >
          <MetricCard label="Parameters" value={formatInteger(summary.totalParameters)} detail="Declared parameter surface across templates" />
          <MetricCard label="Tags" value={formatInteger(summary.totalTags)} detail="Template tag inventory" />
        </Box>

        <LoadableCard
          title="Template registry"
          description="Registry entries with kind, theme binding, and tags."
          state={templates}
          renderContent={(data) => (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Kind</TableCell>
                    <TableCell>Version</TableCell>
                    <TableCell>Theme</TableCell>
                    <TableCell align="right">Parameters</TableCell>
                    <TableCell>Capabilities</TableCell>
                    <TableCell>Tags</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.length > 0 ? (
                    data.map((template) => (
                      <TableRow key={template.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {template.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {template.id}
                          </Typography>
                        </TableCell>
                        <TableCell>{template.kind}</TableCell>
                        <TableCell>{template.version}</TableCell>
                        <TableCell>
                          <StatusBadge label={template.recommendedThemeId ?? 'Default'} tone={themeTone(template.recommendedThemeId)} />
                        </TableCell>
                        <TableCell align="right">{formatInteger(template.parameters.length)}</TableCell>
                        <TableCell>{compactList(template.requiredCapabilities)}</TableCell>
                        <TableCell>{compactList(template.tags)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Typography variant="body2" color="text.secondary">
                          No templates have been registered yet.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
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
            title="Template kinds"
            description="Registered kinds from the template API."
            state={kinds}
            renderContent={(data) => (
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {data.length > 0 ? (
                  data.map((kind) => <StatusBadge key={kind} label={kind} tone="neutral" />)
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No kinds were returned.
                  </Typography>
                )}
              </Stack>
            )}
          />

          <LoadableCard
            title="Selected template"
            description="Detailed parameter contract for the first template."
            state={templates}
            renderContent={(data) => {
              const template = data[0];

              if (template === undefined) {
                return (
                  <Typography variant="body2" color="text.secondary">
                    No template details available.
                  </Typography>
                );
              }

              return (
                <Stack spacing={1.5}>
                  <KeyValueList
                    items={[
                      { label: 'Name', value: template.name },
                      { label: 'Identifier', value: template.id },
                      { label: 'Kind', value: template.kind },
                      { label: 'Version', value: template.version },
                      { label: 'Theme', value: template.recommendedThemeId ?? 'Default' },
                      { label: 'Author', value: template.metadata.author ?? '—' },
                      { label: 'License', value: template.metadata.license ?? '—' },
                      { label: 'Metadata version', value: template.metadata.version },
                      { label: 'Metadata tags', value: compactList(template.metadata.tags) },
                      { label: 'Parameters', value: formatInteger(template.parameters.length) },
                    ]}
                  />

                  <Box sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Parameter</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Required</TableCell>
                          <TableCell>Default</TableCell>
                          <TableCell>Enum</TableCell>
                          <TableCell>Description</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {template.parameters.length > 0 ? (
                          template.parameters.map((parameter) => (
                            <TableRow key={parameter.name} hover>
                              <TableCell sx={{ fontWeight: 700 }}>{parameter.name}</TableCell>
                              <TableCell>{parameter.type}</TableCell>
                              <TableCell>{parameter.required === true ? 'Yes' : 'No'}</TableCell>
                              <TableCell>{formatUnknownValue(parameter.defaultValue)}</TableCell>
                              <TableCell>{compactList(parameter.enumValues ?? [])}</TableCell>
                              <TableCell>{parameter.description ?? '—'}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6}>
                              <Typography variant="body2" color="text.secondary">
                                No parameters are declared for this template.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </Box>
                </Stack>
              );
            }}
          />
        </Box>
      </Stack>
    </PageContainer>
  );
}
