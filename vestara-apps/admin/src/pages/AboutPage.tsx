import packageJson from '../../package.json';
import { Box, Divider, Stack, Typography } from '@mui/material';

import { PageContainer, StatusBadge, useVestaraThemeSnapshot } from '@vestara/ui';

import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { useAdminApiClient } from '../app/hooks/useAdminApiClient.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { formatDateTime, formatDurationMs, formatInteger } from '../app/utils/format.js';
import { toneForStatus } from '../app/utils/status.js';
import { useCapabilityNavigation } from '../app/navigation/CapabilityNavigationProvider.js';

export function AboutPage() {
  const client = useAdminApiClient();
  const themeSnapshot = useVestaraThemeSnapshot();
  const navigation = useCapabilityNavigation();

  const system = useAsyncState((signal) => client.getSystemStatus(signal), [client]);
  const startup = useAsyncState((signal) => client.getStartupSnapshot(signal), [client]);
  const capabilities = useAsyncState(async () => [...navigation.enabledCapabilities], [navigation.enabledCapabilities]);

  return (
    <PageContainer title="About" description="Build, runtime, and control-plane summary.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'System' }, { label: 'About' }]} />

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
          <MetricCard label="Admin version" value={packageJson.version} detail={packageJson.name} tone="healthy" />
          <MetricCard label="Backend" value={system.data?.service ?? '—'} detail={system.data?.apiVersion ?? 'Waiting for system status'} tone="info" />
          <MetricCard label="Capabilities" value={formatInteger(navigation.enabledCapabilities.size)} detail="Enabled capability count" tone="warning" />
          <MetricCard label="Theme" value={themeSnapshot.themeId} detail={themeSnapshot.source} tone={themeSnapshot.source === 'remote' ? 'healthy' : 'warning'} />
        </Box>

        <LoadableCard
          title="Runtime summary"
          description="Backend and frontend runtime information."
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
            title="Startup"
            description="Bootstrap destination and service readiness."
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
                <Typography variant="body2" color="text.secondary">
                  This view is intentionally read-only. It summarizes the current control-plane shell and the backend it is attached to.
                </Typography>
              </Stack>
            )}
          />

          <LoadableCard
            title="Capabilities"
            description="Enabled capability set discovered from the backend."
            state={capabilities}
            tone="healthy"
            renderContent={(catalog) => (
              <Stack spacing={1.5}>
                <KeyValueList items={[{ label: 'Enabled', value: formatInteger(catalog.length) }]} />
                <Divider />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {catalog.map((capability) => (
                    <StatusBadge key={capability} label={capability} tone="neutral" />
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
