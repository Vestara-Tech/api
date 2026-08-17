import { Box, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { PageContainer, StatusBadge } from '@vestara/ui';

import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { useAdminApiClient } from '../app/hooks/useAdminApiClient.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { compactList, formatDateTime, formatInteger } from '../app/utils/format.js';

export function FilesPage() {
  const client = useAdminApiClient();

  const workspaces = useAsyncState((signal) => client.listFileWorkspaces(signal), [client]);
  const events = useAsyncState((signal) => client.listFileEvents(signal), [client]);

  const providerCount = new Set(workspaces.data?.map((workspace) => workspace.providerId) ?? []).size;
  const patternCount = workspaces.data?.reduce((count, workspace) => count + (workspace.include?.length ?? 0) + (workspace.exclude?.length ?? 0), 0);

  return (
    <PageContainer title="Files" description="Mounted workspaces, file events, and provider coverage.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Data' }, { label: 'Files' }]} />

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
          <MetricCard label="Workspaces" value={formatInteger(workspaces.data?.length)} detail="Mounted file workspaces" tone="healthy" />
          <MetricCard label="Providers" value={formatInteger(providerCount)} detail="Distinct workspace providers" tone="info" />
          <MetricCard label="Events" value={formatInteger(events.data?.length)} detail="Recent file events" tone="warning" />
          <MetricCard label="Patterns" value={formatInteger(patternCount)} detail="Include/exclude rules" tone="neutral" />
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
            title="Workspaces"
            description="Mounted file roots and their revision state."
            state={workspaces}
            tone="healthy"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Root</TableCell>
                    <TableCell>Provider</TableCell>
                    <TableCell>Patterns</TableCell>
                    <TableCell>Revision</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((workspace) => (
                    <TableRow key={workspace.id}>
                      <TableCell sx={{ fontWeight: 600 }}>{workspace.name}</TableCell>
                      <TableCell>{workspace.root}</TableCell>
                      <TableCell>{workspace.providerId}</TableCell>
                      <TableCell>{compactList([...(workspace.include ?? []), ...(workspace.exclude ?? [])])}</TableCell>
                      <TableCell>{workspace.revision}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Events"
            description="File-system activity and transaction events."
            state={events}
            tone="warning"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Workspace</TableCell>
                    <TableCell>Path</TableCell>
                    <TableCell>At</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((event, index) => (
                    <TableRow key={`${event.type}:${event.at}:${index}`}>
                      <TableCell sx={{ fontWeight: 600 }}>
                        <StatusBadge label={event.type} tone="neutral" />
                      </TableCell>
                      <TableCell>{event.workspaceId ?? '—'}</TableCell>
                      <TableCell>{event.path ?? '—'}</TableCell>
                      <TableCell>{formatDateTime(event.at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Workspace coverage"
            description="Provider and pattern coverage across mounted workspaces."
            state={workspaces}
            tone="info"
            renderContent={(catalog) => (
              <Stack spacing={2}>
                <KeyValueList
                  items={[
                    { label: 'Workspaces', value: formatInteger(catalog.length) },
                    { label: 'Providers', value: formatInteger(new Set(catalog.map((workspace) => workspace.providerId)).size) },
                    { label: 'Patterns', value: formatInteger(catalog.reduce((count, workspace) => count + (workspace.include?.length ?? 0) + (workspace.exclude?.length ?? 0), 0)) },
                  ]}
                />
                <Divider />
                <Typography variant="body2" color="text.secondary">
                  File mutations still route through governed transactions; this page only surfaces current workspace state.
                </Typography>
              </Stack>
            )}
          />

          <LoadableCard
            title="Provider inventory"
            description="Distinct providers used by the mounted file workspaces."
            state={workspaces}
            tone="neutral"
            renderContent={(catalog) => (
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {Array.from(new Set(catalog.map((workspace) => workspace.providerId))).map((providerId) => (
                  <StatusBadge key={providerId} label={providerId} tone="neutral" />
                ))}
              </Stack>
            )}
          />
        </Box>
      </Stack>
    </PageContainer>
  );
}
