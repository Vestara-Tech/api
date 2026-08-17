import { Box, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { PageContainer, StatusBadge, type StatusTone } from '@vestara/ui';

import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { useWorkspaceApiClient } from '../app/hooks/useWorkspaceApiClient.js';
import { compactList, formatDateTime, formatInteger } from '../app/utils/format.js';
import { summarizeDashboards } from '../app/utils/summaries.js';

function refreshTone(mode: string): StatusTone {
  switch (mode) {
    case 'live':
    case 'stream':
      return 'healthy';
    case 'interval':
      return 'info';
    default:
      return 'neutral';
  }
}

function widgetTone(state: string): StatusTone {
  switch (state) {
    case 'ready':
    case 'healthy':
      return 'healthy';
    case 'degraded':
    case 'stale':
      return 'warning';
    case 'error':
      return 'critical';
    default:
      return 'neutral';
  }
}

export function DashboardsPage() {
  const client = useWorkspaceApiClient();
  const dashboards = useAsyncState((signal) => client.listDashboards(signal), [client]);
  const summary = summarizeDashboards(dashboards.data ?? []);

  return (
    <PageContainer title="Dashboards" description="Dashboard definitions, widget inventories, and refresh policies.">
      <Stack spacing={2.5}>
        <PageBreadcrumbs
          items={[
            { label: 'Workspace', href: '/workspace/overview' },
            { label: 'Compose' },
            { label: 'Dashboards' },
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
          <MetricCard label="Dashboards" value={formatInteger(summary.totalDashboards)} detail="Declared dashboard definitions" />
          <MetricCard label="Published" value={formatInteger(summary.publishedDashboards)} detail="Dashboards with publish timestamps" />
          <MetricCard label="Widgets" value={formatInteger(summary.totalWidgets)} detail="Total widget instances" />
          <MetricCard label="Scopes" value={formatInteger(summary.scopes)} detail="Distinct dashboard scopes" />
        </Box>

        <MetricCard label="Placements" value={formatInteger(summary.totalPlacements)} detail="Layout placements across dashboards" />

        <LoadableCard
          title="Dashboard registry"
          description="Scopes, widget counts, and refresh policy inventory."
          state={dashboards}
          renderContent={(data) => (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Scope</TableCell>
                    <TableCell align="right">Widgets</TableCell>
                    <TableCell>Refresh</TableCell>
                    <TableCell>Revision</TableCell>
                    <TableCell>Published</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.length > 0 ? (
                    data.map((dashboard) => (
                      <TableRow key={dashboard.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {dashboard.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {dashboard.id}
                          </Typography>
                        </TableCell>
                        <TableCell>{dashboard.scope}</TableCell>
                        <TableCell align="right">{formatInteger(dashboard.widgets.length)}</TableCell>
                        <TableCell>
                          <StatusBadge label={dashboard.refreshPolicy.mode} tone={refreshTone(dashboard.refreshPolicy.mode)} />
                        </TableCell>
                        <TableCell>{dashboard.revision}</TableCell>
                        <TableCell>{dashboard.publishedAt !== undefined ? formatDateTime(dashboard.publishedAt) : '—'}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography variant="body2" color="text.secondary">
                          No dashboards have been registered yet.
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
          title="Selected dashboard"
          description="Widget inventory for the first dashboard definition."
          state={dashboards}
          renderContent={(data) => {
            const dashboard = data[0];

            if (dashboard === undefined) {
              return (
                <Typography variant="body2" color="text.secondary">
                  No dashboard details available.
                </Typography>
              );
            }

            return (
              <Stack spacing={1.5}>
                <KeyValueList
                  items={[
                    { label: 'Name', value: dashboard.name },
                    { label: 'Identifier', value: dashboard.id },
                    { label: 'Scope', value: dashboard.scope },
                    { label: 'Revision', value: formatInteger(dashboard.revision) },
                    { label: 'Refresh mode', value: <StatusBadge label={dashboard.refreshPolicy.mode} tone={refreshTone(dashboard.refreshPolicy.mode)} /> },
                    { label: 'Refresh interval', value: dashboard.refreshPolicy.intervalSeconds !== undefined ? `${dashboard.refreshPolicy.intervalSeconds}s` : '—' },
                    { label: 'Widgets', value: formatInteger(dashboard.widgets.length) },
                    { label: 'Filters', value: formatInteger(dashboard.filters.length) },
                    { label: 'Created', value: formatDateTime(dashboard.createdAt) },
                    { label: 'Updated', value: formatDateTime(dashboard.updatedAt) },
                    { label: 'Published', value: dashboard.publishedAt !== undefined ? formatDateTime(dashboard.publishedAt) : '—' },
                  ]}
                />

                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Widget</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>State</TableCell>
                        <TableCell>Placement</TableCell>
                        <TableCell>Refresh</TableCell>
                        <TableCell>Updated</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {dashboard.widgets.length > 0 ? (
                        dashboard.widgets.map((widget) => (
                          <TableRow key={widget.id} hover>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {widget.title ?? widget.id}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {widget.id}
                              </Typography>
                            </TableCell>
                            <TableCell>{widget.type}</TableCell>
                            <TableCell>
                              <StatusBadge label={widget.state} tone={widgetTone(widget.state)} />
                            </TableCell>
                            <TableCell>
                              {widget.placement.breakpoint} · {widget.placement.x},{widget.placement.y} · {widget.placement.width}×{widget.placement.height}
                            </TableCell>
                            <TableCell>{widget.refreshIntervalSeconds !== undefined ? `${widget.refreshIntervalSeconds}s` : '—'}</TableCell>
                            <TableCell>{widget.lastUpdatedAt !== undefined ? formatDateTime(widget.lastUpdatedAt) : '—'}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6}>
                            <Typography variant="body2" color="text.secondary">
                              No widgets are configured for this dashboard.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Box>

                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    Widget summary
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Widget types: {compactList(dashboard.widgets.map((widget) => widget.type))}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Widget states: {compactList(dashboard.widgets.map((widget) => widget.state))}
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
