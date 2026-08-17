import { Box, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { PageContainer, StatusBadge, type StatusTone } from '@vestara/ui';

import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { useWorkspaceApiClient } from '../app/hooks/useWorkspaceApiClient.js';
import { compactList, formatDateTime, formatInteger } from '../app/utils/format.js';
import { summarizeApplications } from '../app/utils/summaries.js';

function lifecycleTone(lifecycle: string): StatusTone {
  switch (lifecycle) {
    case 'published':
    case 'ready':
      return 'healthy';
    case 'draft':
    case 'review':
    case 'testing':
      return 'info';
    case 'deprecated':
      return 'warning';
    case 'failed':
      return 'critical';
    default:
      return 'neutral';
  }
}

function authTone(enabled: boolean): StatusTone {
  return enabled ? 'healthy' : 'warning';
}

export function ApplicationsPage() {
  const client = useWorkspaceApiClient();
  const applications = useAsyncState((signal) => client.listApplications(signal), [client]);
  const summary = summarizeApplications(applications.data ?? []);

  return (
    <PageContainer title="Applications" description="Application definitions, routes, workflow bindings, and integration inventory.">
      <Stack spacing={2.5}>
        <PageBreadcrumbs
          items={[
            { label: 'Workspace', href: '/workspace/overview' },
            { label: 'Compose' },
            { label: 'Applications' },
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
          <MetricCard label="Applications" value={formatInteger(summary.totalApplications)} detail="Declared application definitions" />
          <MetricCard label="Published" value={formatInteger(summary.publishedApplications)} detail="Published lifecycle entries" />
          <MetricCard label="Routes" value={formatInteger(summary.totalRoutes)} detail="Application route inventory" />
          <MetricCard label="Pages" value={formatInteger(summary.totalPages)} detail="Referenced page inventory" />
        </Box>

        <MetricCard label="Auth enabled" value={formatInteger(summary.authEnabledApplications)} detail="Applications with authentication enabled" />

        <LoadableCard
          title="Application registry"
          description="Lifecycle, route, workflow, and integration coverage."
          state={applications}
          renderContent={(data) => (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Lifecycle</TableCell>
                    <TableCell align="right">Pages</TableCell>
                    <TableCell align="right">Routes</TableCell>
                    <TableCell>Workflows</TableCell>
                    <TableCell>Integrations</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.length > 0 ? (
                    data.map((application) => (
                      <TableRow key={application.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {application.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {application.id}
                          </Typography>
                        </TableCell>
                        <TableCell>{application.applicationType}</TableCell>
                        <TableCell>
                          <StatusBadge label={application.lifecycle} tone={lifecycleTone(application.lifecycle)} />
                        </TableCell>
                        <TableCell align="right">{formatInteger(application.pages.length)}</TableCell>
                        <TableCell align="right">{formatInteger(application.routes.length)}</TableCell>
                        <TableCell>{compactList(application.workflows)}</TableCell>
                        <TableCell>{compactList(application.integrations)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Typography variant="body2" color="text.secondary">
                          No applications have been registered yet.
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
          title="Selected application"
          description="Operational details for the first application definition."
          state={applications}
          renderContent={(data) => {
            const application = data[0];

            if (application === undefined) {
              return (
                <Typography variant="body2" color="text.secondary">
                  No application details available.
                </Typography>
              );
            }

            return (
              <Stack spacing={1.5}>
                <KeyValueList
                  items={[
                    { label: 'Name', value: application.name },
                    { label: 'Identifier', value: application.id },
                    { label: 'Version', value: application.version },
                    { label: 'Type', value: application.applicationType },
                    { label: 'Lifecycle', value: <StatusBadge label={application.lifecycle} tone={lifecycleTone(application.lifecycle)} /> },
                    { label: 'Revision', value: formatInteger(application.revision) },
                    { label: 'Updated', value: formatDateTime(application.updatedAt) },
                    { label: 'Auth enabled', value: <StatusBadge label={application.authentication.enabled ? 'Enabled' : 'Disabled'} tone={authTone(application.authentication.enabled)} /> },
                    { label: 'Auth provider', value: application.authentication.provider },
                    { label: 'Pages', value: formatInteger(application.pages.length) },
                    { label: 'Routes', value: formatInteger(application.routes.length) },
                    { label: 'Workflows', value: compactList(application.workflows) },
                    { label: 'Agents', value: compactList(application.agents) },
                    { label: 'Integrations', value: compactList(application.integrations) },
                  ]}
                />

                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Route</TableCell>
                        <TableCell>Page</TableCell>
                        <TableCell>Auth</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {application.routes.length > 0 ? (
                        application.routes.map((route) => (
                          <TableRow key={`${route.path}:${route.pageId}`} hover>
                            <TableCell sx={{ fontWeight: 700 }}>{route.path}</TableCell>
                            <TableCell>{route.pageId}</TableCell>
                            <TableCell>
                              <StatusBadge label={route.authRequired ? 'Required' : 'Open'} tone={route.authRequired ? 'warning' : 'healthy'} />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3}>
                            <Typography variant="body2" color="text.secondary">
                              No routes are declared for this application.
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

        <LoadableCard
          title="Application composition"
          description="Page and route mappings across the current registry."
          state={applications}
          renderContent={(data) => (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Application</TableCell>
                    <TableCell align="right">Pages</TableCell>
                    <TableCell align="right">Routes</TableCell>
                    <TableCell align="right">Workflows</TableCell>
                    <TableCell align="right">Agents</TableCell>
                    <TableCell align="right">Integrations</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.length > 0 ? (
                    data.map((application) => (
                      <TableRow key={`composition:${application.id}`} hover>
                        <TableCell>{application.name}</TableCell>
                        <TableCell align="right">{formatInteger(application.pages.length)}</TableCell>
                        <TableCell align="right">{formatInteger(application.routes.length)}</TableCell>
                        <TableCell align="right">{formatInteger(application.workflows.length)}</TableCell>
                        <TableCell align="right">{formatInteger(application.agents.length)}</TableCell>
                        <TableCell align="right">{formatInteger(application.integrations.length)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography variant="body2" color="text.secondary">
                          No applications were returned.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          )}
        />

        <Box>
          <Typography variant="body2" color="text.secondary">
            Integrated applications: {formatInteger(summary.integratedApplications)}
          </Typography>
        </Box>
      </Stack>
    </PageContainer>
  );
}
