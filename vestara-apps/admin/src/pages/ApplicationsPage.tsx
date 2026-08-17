import { Box, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { PageContainer, StatusBadge } from '@vestara/ui';

import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { useAdminApiClient } from '../app/hooks/useAdminApiClient.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { formatDateTime, formatInteger } from '../app/utils/format.js';
import { toneForStatus } from '../app/utils/status.js';

export function ApplicationsPage() {
  const client = useAdminApiClient();

  const applications = useAsyncState((signal) => client.listApplications(signal), [client]);
  const firstApplicationId = applications.data?.[0]?.id;
  const model = useAsyncState(
    async (signal) => {
      if (firstApplicationId === undefined) return undefined;
      return client.getApplicationModel(firstApplicationId, signal);
    },
    [client, firstApplicationId],
  );

  const pageRefs = applications.data?.reduce((count, app) => count + app.pages.length, 0);
  const routeCount = applications.data?.reduce((count, app) => count + app.routes.length, 0);
  const integrations = new Set(applications.data?.flatMap((app) => app.integrations) ?? []);

  return (
    <PageContainer title="Applications" description="Application definitions, routing, and integration inventory.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Build' }, { label: 'Applications' }]} />

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
          <MetricCard label="Applications" value={formatInteger(applications.data?.length)} detail="Declarative applications" tone="healthy" />
          <MetricCard label="Pages" value={formatInteger(pageRefs)} detail="Application page references" tone="info" />
          <MetricCard label="Routes" value={formatInteger(routeCount)} detail="Application routes" tone="warning" />
          <MetricCard label="Integrations" value={formatInteger(integrations.size)} detail="Integration tags" tone="neutral" />
        </Box>

        <LoadableCard
          title="Applications"
          description="Current application builder inventory."
          state={applications}
          tone="healthy"
          renderContent={(catalog) => (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Application</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Pages</TableCell>
                  <TableCell>Routes</TableCell>
                  <TableCell>Integrations</TableCell>
                  <TableCell>Lifecycle</TableCell>
                  <TableCell>Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {catalog.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell sx={{ fontWeight: 600 }}>
                      <Stack spacing={0.25}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {app.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {app.id}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{app.applicationType}</TableCell>
                    <TableCell>{app.pages.length}</TableCell>
                    <TableCell>{app.routes.length}</TableCell>
                    <TableCell>{app.integrations.length}</TableCell>
                    <TableCell>
                      <StatusBadge label={app.lifecycle} tone={toneForStatus(app.lifecycle)} />
                    </TableCell>
                    <TableCell>{formatDateTime(app.updatedAt)}</TableCell>
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
            title="Model preview"
            description={firstApplicationId !== undefined ? `Resolved application model for ${firstApplicationId}.` : 'No applications available.'}
            state={model}
            tone="info"
            renderContent={(view) => {
              if (view === undefined) return null;

              return (
                <Stack spacing={2}>
                  <KeyValueList
                    items={[
                      { label: 'Lifecycle', value: view.lifecycle },
                      { label: 'Definition revision', value: formatInteger(view.definition.revision) },
                      { label: 'Resolved pages', value: formatInteger(view.pages.length) },
                      { label: 'Auth provider', value: view.definition.authentication.provider },
                    ]}
                  />
                  <Divider />
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Page</TableCell>
                        <TableCell>Route</TableCell>
                        <TableCell>Default</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {view.pages.map((page) => (
                        <TableRow key={`${page.pageId}:${page.path}`}>
                          <TableCell sx={{ fontWeight: 600 }}>{page.name ?? page.pageId}</TableCell>
                          <TableCell>{page.route ?? page.path}</TableCell>
                          <TableCell>{page.default === true ? 'Yes' : 'No'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Stack>
              );
            }}
        />

          <LoadableCard
            title="Integration surface"
            description="Integration tags declared by applications."
            state={applications}
            tone="warning"
            renderContent={(catalog) => (
              <Stack spacing={1.5}>
                <KeyValueList
                  items={[
                    { label: 'Applications', value: formatInteger(catalog.length) },
                    { label: 'Integrations', value: formatInteger(catalog.reduce((count, app) => count + app.integrations.length, 0)) },
                  ]}
                />
                <Divider />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {Array.from(new Set(catalog.flatMap((app) => app.integrations))).map((integration) => (
                    <StatusBadge key={integration} label={integration} tone="neutral" />
                  ))}
                </Stack>
              </Stack>
            )}
          />

          <LoadableCard
            title="Auth posture"
            description="Application authentication modes."
            state={applications}
            tone="neutral"
            renderContent={(catalog) => (
              <Stack spacing={1.5}>
                <KeyValueList
                  items={[
                    { label: 'Auth-enabled', value: formatInteger(catalog.filter((app) => app.authentication.enabled).length) },
                    { label: 'Providers', value: formatInteger(new Set(catalog.map((app) => app.authentication.provider)).size) },
                  ]}
                />
                <Divider />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {Array.from(new Set(catalog.map((app) => app.authentication.provider))).map((provider) => (
                    <StatusBadge key={provider} label={provider} tone="healthy" />
                  ))}
                </Stack>
              </Stack>
            )}
          />

          <LoadableCard
            title="Route coverage"
            description="Declared route count across applications."
            state={applications}
            tone="healthy"
            renderContent={(catalog) => (
              <Stack spacing={1.5}>
                <KeyValueList
                  items={[
                    { label: 'Routes', value: formatInteger(catalog.reduce((count, app) => count + app.routes.length, 0)) },
                    { label: 'Pages', value: formatInteger(catalog.reduce((count, app) => count + app.pages.length, 0)) },
                  ]}
                />
                <Divider />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {catalog.flatMap((app) => app.routes).slice(0, 12).map((route) => (
                    <StatusBadge key={`${route.path}:${route.pageId}`} label={route.path} tone="neutral" />
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
