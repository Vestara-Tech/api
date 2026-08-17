import { Box, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { PageContainer, StatusBadge } from '@vestara/ui';

import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { useAdminApiClient } from '../app/hooks/useAdminApiClient.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { compactList, formatInteger } from '../app/utils/format.js';
import { toneForStatus } from '../app/utils/status.js';

export function IntegrationsPage() {
  const client = useAdminApiClient();

  const applications = useAsyncState((signal) => client.listApplications(signal), [client]);

  const appWithIntegrations = applications.data?.filter((app) => app.integrations.length > 0).length;
  const totalIntegrations = applications.data?.reduce((count, app) => count + app.integrations.length, 0);
  const uniqueIntegrations = new Set(applications.data?.flatMap((app) => app.integrations) ?? []);

  return (
    <PageContainer title="Integrations" description="Application integration inventory and surface coverage.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Manage' }, { label: 'Integrations' }]} />

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
          <MetricCard label="Applications" value={formatInteger(applications.data?.length)} detail="Registered applications" tone="healthy" />
          <MetricCard label="With integrations" value={formatInteger(appWithIntegrations)} detail="Applications with integrations" tone="info" />
          <MetricCard label="Integration refs" value={formatInteger(totalIntegrations)} detail="Declared integration references" tone="warning" />
          <MetricCard label="Unique" value={formatInteger(uniqueIntegrations.size)} detail="Unique integration tags" tone="neutral" />
        </Box>

        <LoadableCard
          title="Application integrations"
          description="Declared integration tags by application definition."
          state={applications}
          tone="healthy"
          renderContent={(catalog) => (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Application</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Integrations</TableCell>
                  <TableCell>APIs</TableCell>
                  <TableCell>Databases</TableCell>
                  <TableCell>Auth</TableCell>
                  <TableCell>Lifecycle</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {catalog.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell sx={{ fontWeight: 600 }}>
                      <Stack spacing={0.25}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {application.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {application.id}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{application.applicationType}</TableCell>
                    <TableCell>{compactList(application.integrations)}</TableCell>
                    <TableCell>{application.apis.length}</TableCell>
                    <TableCell>{application.databases.length}</TableCell>
                    <TableCell>
                      <StatusBadge label={application.authentication.enabled ? application.authentication.provider : 'Disabled'} tone={toneForStatus(application.authentication.enabled ? 'healthy' : 'warning')} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge label={application.lifecycle} tone={toneForStatus(application.lifecycle)} />
                    </TableCell>
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
            title="Integration tags"
            description="Unique tags discovered across applications."
            state={applications}
            tone="info"
            renderContent={(catalog) => (
              <Stack spacing={1.5}>
                <KeyValueList
                  items={[
                    { label: 'Applications', value: formatInteger(catalog.length) },
                    { label: 'Tagged apps', value: formatInteger(catalog.filter((app) => app.integrations.length > 0).length) },
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
            title="Capability coverage"
            description="Where integrations sit inside the application platform."
            state={applications}
            tone="warning"
            renderContent={(catalog) => (
              <Stack spacing={1.5}>
                <KeyValueList
                  items={[
                    { label: 'Auth-enabled apps', value: formatInteger(catalog.filter((app) => app.authentication.enabled).length) },
                    { label: 'Routes', value: formatInteger(catalog.reduce((count, app) => count + app.routes.length, 0)) },
                    { label: 'Pages', value: formatInteger(catalog.reduce((count, app) => count + app.pages.length, 0)) },
                  ]}
                />
                <Divider />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {catalog.slice(0, 10).map((app) => (
                    <StatusBadge key={app.id} label={app.applicationType} tone="neutral" />
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
