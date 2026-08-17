import { Box, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { PageContainer, StatusBadge, useVestaraThemeSnapshot } from '@vestara/ui';

import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { useAdminApiClient } from '../app/hooks/useAdminApiClient.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { formatDateTime, formatDurationMs, formatInteger } from '../app/utils/format.js';
import { toneForStatus } from '../app/utils/status.js';

export function SettingsPage() {
  const client = useAdminApiClient();
  const themeSnapshot = useVestaraThemeSnapshot();

  const system = useAsyncState((signal) => client.getSystemStatus(signal), [client]);
  const startup = useAsyncState((signal) => client.getStartupSnapshot(signal), [client]);
  const themes = useAsyncState((signal) => client.listThemes(signal), [client]);

  return (
    <PageContainer title="Settings" description="Theme catalog, startup state, and platform configuration context.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'System' }, { label: 'Settings' }]} />

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
          <MetricCard label="Current theme" value={themeSnapshot.themeId} detail={themeSnapshot.source} tone={themeSnapshot.source === 'remote' ? 'healthy' : 'warning'} />
          <MetricCard label="Theme catalog" value={formatInteger(themes.data?.length)} detail="Backend theme registry" tone="info" />
          <MetricCard label="API version" value={system.data?.apiVersion ?? '—'} detail={system.data?.contractVersion ?? 'Waiting for system status'} tone="healthy" />
          <MetricCard label="Startup" value={startup.data?.state.status ?? '—'} detail={startup.data?.state.destination ?? 'Awaiting startup snapshot'} tone={toneForStatus(startup.data?.state.status)} />
        </Box>

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
            title="Platform settings"
            description="Backend identity, uptime, and startup routing details."
            state={system}
            tone="info"
            renderContent={(view) => (
              <Stack spacing={2}>
                <KeyValueList
                  items={[
                    { label: 'Service', value: view.service },
                    { label: 'API version', value: view.apiVersion },
                    { label: 'Contract version', value: view.contractVersion },
                    { label: 'Started at', value: formatDateTime(view.startedAt) },
                    { label: 'Uptime', value: formatDurationMs(view.uptimeMs) },
                  ]}
                />
                <Divider />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  <StatusBadge label={themeSnapshot.source === 'remote' ? 'Remote theme' : 'Fallback theme'} tone={themeSnapshot.source === 'remote' ? 'healthy' : 'warning'} />
                  <StatusBadge label={themeSnapshot.status} tone={toneForStatus(themeSnapshot.status)} />
                </Stack>
              </Stack>
            )}
          />

          <LoadableCard
            title="Startup snapshot"
            description="Bootstrap status, destination, and service readiness."
            state={startup}
            tone="warning"
            renderContent={(snapshot) => (
              <Stack spacing={2}>
                <KeyValueList
                  items={[
                    { label: 'Status', value: snapshot.state.status },
                    { label: 'Destination', value: snapshot.state.destination },
                    { label: 'First boot', value: snapshot.state.firstBoot ? 'Yes' : 'No' },
                    { label: 'Authenticated', value: snapshot.state.authenticated ? 'Yes' : 'No' },
                    { label: 'Session ready', value: snapshot.state.sessionReady ? 'Yes' : 'No' },
                  ]}
                />
                <Divider />
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Service</TableCell>
                      <TableCell>Readiness</TableCell>
                      <TableCell>Weight</TableCell>
                      <TableCell>Updated</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {snapshot.services.map((service) => (
                      <TableRow key={service.serviceId}>
                        <TableCell sx={{ fontWeight: 600 }}>{service.serviceId}</TableCell>
                        <TableCell>
                          <StatusBadge label={service.readiness} tone={toneForStatus(service.readiness)} />
                        </TableCell>
                        <TableCell>{service.weight}</TableCell>
                        <TableCell>{formatDateTime(service.updatedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Stack>
            )}
          />

          <LoadableCard
            title="Theme catalog"
            description="Available backend themes and their metadata."
            state={themes}
            tone="healthy"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Version</TableCell>
                    <TableCell>Mode</TableCell>
                    <TableCell>Tokens</TableCell>
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
                      <TableCell>{theme.version}</TableCell>
                      <TableCell>{theme.mode}</TableCell>
                      <TableCell>{Object.keys(theme.tokens).length}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Current theme"
            description="Frontend theme snapshot from the shared Vestara provider."
            state={{ status: 'ready', data: themeSnapshot, error: undefined }}
            tone={themeSnapshot.source === 'remote' ? 'healthy' : 'warning'}
            renderContent={() => (
              <Stack spacing={2}>
                <KeyValueList
                  items={[
                    { label: 'Theme id', value: themeSnapshot.themeId },
                    { label: 'Source', value: themeSnapshot.source },
                    { label: 'Status', value: themeSnapshot.status },
                    { label: 'Error', value: themeSnapshot.error ?? '—' },
                  ]}
                />
                <Divider />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  <StatusBadge label={themeSnapshot.themeId} tone="neutral" />
                  <StatusBadge label={themeSnapshot.source} tone={themeSnapshot.source === 'remote' ? 'healthy' : 'warning'} />
                </Stack>
              </Stack>
            )}
          />
        </Box>
      </Stack>
    </PageContainer>
  );
}
