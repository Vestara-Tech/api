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

export function DashboardsPage() {
  const client = useAdminApiClient();

  const dashboards = useAsyncState((signal) => client.listDashboards(signal), [client]);
  const widgets = useAsyncState((signal) => client.listDashboardWidgets(signal), [client]);
  const firstDashboardId = dashboards.data?.[0]?.id;
  const projections = useAsyncState(
    async (signal) => {
      if (firstDashboardId === undefined) return [];
      return client.getDashboardProjection(firstDashboardId, signal);
    },
    [client, firstDashboardId],
  );

  const publishedCount = dashboards.data?.filter((dashboard) => dashboard.publishedAt !== undefined).length;
  const widgetCount = dashboards.data?.reduce((count, dashboard) => count + dashboard.widgets.length, 0);

  return (
    <PageContainer title="Dashboards" description="Dashboard definitions, widget registry, and projection snapshots.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Build' }, { label: 'Dashboards' }]} />

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
          <MetricCard label="Dashboards" value={formatInteger(dashboards.data?.length)} detail="Declarative dashboards" tone="healthy" />
          <MetricCard label="Widgets" value={formatInteger(widgetCount)} detail="Widget instances across dashboards" tone="info" />
          <MetricCard label="Published" value={formatInteger(publishedCount)} detail="Published dashboards" tone="warning" />
          <MetricCard label="Widget defs" value={formatInteger(widgets.data?.length)} detail="Widget registry entries" tone="neutral" />
        </Box>

        <LoadableCard
          title="Dashboards"
          description="Current dashboard registry state."
          state={dashboards}
          tone="healthy"
          renderContent={(catalog) => (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Dashboard</TableCell>
                  <TableCell>Scope</TableCell>
                  <TableCell>Widgets</TableCell>
                  <TableCell>Refresh</TableCell>
                  <TableCell>Revision</TableCell>
                  <TableCell>Published</TableCell>
                  <TableCell>Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {catalog.map((dashboard) => (
                  <TableRow key={dashboard.id}>
                    <TableCell sx={{ fontWeight: 600 }}>
                      <Stack spacing={0.25}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {dashboard.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {dashboard.id}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{dashboard.scope}</TableCell>
                    <TableCell>{dashboard.widgets.length}</TableCell>
                    <TableCell>{dashboard.refreshPolicy.mode}{dashboard.refreshPolicy.intervalSeconds !== undefined ? ` / ${dashboard.refreshPolicy.intervalSeconds}s` : ''}</TableCell>
                    <TableCell>{dashboard.revision}</TableCell>
                    <TableCell>{dashboard.publishedAt !== undefined ? formatDateTime(dashboard.publishedAt) : '—'}</TableCell>
                    <TableCell>{formatDateTime(dashboard.updatedAt)}</TableCell>
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
            title="Widget registry"
            description="Available dashboard widgets and their data sources."
            state={widgets}
            tone="info"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Module</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Configurable</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((widget) => (
                    <TableRow key={widget.type}>
                      <TableCell sx={{ fontWeight: 600 }}>{widget.type}</TableCell>
                      <TableCell>{widget.moduleId}</TableCell>
                      <TableCell>{widget.title}</TableCell>
                      <TableCell>{widget.dataSource.type}{widget.dataSource.moduleId !== undefined ? ` / ${widget.dataSource.moduleId}` : ''}{widget.dataSource.projection !== undefined ? ` / ${widget.dataSource.projection}` : ''}</TableCell>
                      <TableCell>{widget.configurable ? 'Yes' : 'No'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Projection snapshot"
            description={firstDashboardId !== undefined ? `Projection output for ${firstDashboardId}.` : 'No dashboards available.'}
            state={projections}
            tone="warning"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Projection</TableCell>
                    <TableCell>Module</TableCell>
                    <TableCell>State</TableCell>
                    <TableCell>Duration</TableCell>
                    <TableCell>Cached</TableCell>
                    <TableCell>Stale</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((projection) => (
                    <TableRow key={projection.projectionId}>
                      <TableCell sx={{ fontWeight: 600 }}>{projection.projectionId}</TableCell>
                      <TableCell>{projection.moduleId}</TableCell>
                      <TableCell>
                        <StatusBadge label={projection.state} tone={toneForStatus(projection.state)} />
                      </TableCell>
                      <TableCell>{projection.durationMs !== undefined ? `${projection.durationMs} ms` : '—'}</TableCell>
                      <TableCell>{projection.cachedAt !== undefined ? formatDateTime(projection.cachedAt) : '—'}</TableCell>
                      <TableCell>{projection.stale === true ? 'Yes' : 'No'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Layout footprint"
            description="Dashboard layout distribution and widget density."
            state={dashboards}
            tone="neutral"
            renderContent={(catalog) => (
              <Stack spacing={1.5}>
                <KeyValueList
                  items={[
                    { label: 'Dashboards', value: formatInteger(catalog.length) },
                    { label: 'Widgets', value: formatInteger(catalog.reduce((count, dashboard) => count + dashboard.widgets.length, 0)) },
                    { label: 'Scopes', value: formatInteger(new Set(catalog.map((dashboard) => dashboard.scope)).size) },
                  ]}
                />
                <Divider />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {Array.from(new Set(catalog.map((dashboard) => dashboard.scope))).map((scope) => (
                    <StatusBadge key={scope} label={scope} tone="neutral" />
                  ))}
                </Stack>
              </Stack>
            )}
          />

          <LoadableCard
            title="Widget coverage"
            description="Unique widget types deployed by dashboards."
            state={dashboards}
            tone="healthy"
            renderContent={(catalog) => (
              <Stack spacing={1.5}>
                <KeyValueList
                  items={[
                    { label: 'Widget types', value: formatInteger(new Set(catalog.flatMap((dashboard) => dashboard.widgets.map((widget) => widget.type))).size) },
                    { label: 'Published', value: formatInteger(catalog.filter((dashboard) => dashboard.publishedAt !== undefined).length) },
                  ]}
                />
                <Divider />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {Array.from(new Set(catalog.flatMap((dashboard) => dashboard.widgets.map((widget) => widget.type)))).slice(0, 16).map((widgetType) => (
                    <StatusBadge key={widgetType} label={widgetType} tone="neutral" />
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
