import { Box, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { PageContainer, StatusBadge } from '@vestara/ui';

import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { useAdminApiClient } from '../app/hooks/useAdminApiClient.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { compactList, formatDateTime, formatInteger } from '../app/utils/format.js';

export function ContextPage() {
  const client = useAdminApiClient();

  const providers = useAsyncState((signal) => client.listContextProviders(signal), [client]);
  const snapshots = useAsyncState((signal) => client.listContextSnapshots(signal), [client]);

  const bundleItems = snapshots.data?.reduce((count, snapshot) => count + snapshot.items.length, 0);

  return (
    <PageContainer title="Context" description="Context providers, snapshots, and bundle inventory.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Data' }, { label: 'Context' }]} />

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
          <MetricCard label="Providers" value={formatInteger(providers.data?.length)} detail="Context providers" tone="healthy" />
          <MetricCard label="Snapshots" value={formatInteger(snapshots.data?.length)} detail="Stored context snapshots" tone="info" />
          <MetricCard label="Bundle items" value={formatInteger(bundleItems)} detail="Collected context items" tone="warning" />
          <MetricCard label="Scopes" value={formatInteger(new Set(providers.data?.map((provider) => provider.scope) ?? []).size)} detail="Context scopes" tone="neutral" />
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
            title="Providers"
            description="Context provider registry."
            state={providers}
            tone="healthy"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Provider</TableCell>
                    <TableCell>Scope</TableCell>
                    <TableCell>Kinds</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((provider) => (
                    <TableRow key={provider.id}>
                      <TableCell sx={{ fontWeight: 600 }}>{provider.id}</TableCell>
                      <TableCell>{provider.scope}</TableCell>
                      <TableCell>{compactList(provider.kinds)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Snapshots"
            description="Persisted context bundles and their references."
            state={snapshots}
            tone="warning"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Snapshot</TableCell>
                    <TableCell>Bundle</TableCell>
                    <TableCell>Items</TableCell>
                    <TableCell>Created</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((snapshot) => (
                    <TableRow key={snapshot.id}>
                      <TableCell sx={{ fontWeight: 600 }}>{snapshot.id}</TableCell>
                      <TableCell>{snapshot.bundleHash.slice(0, 12)}</TableCell>
                      <TableCell>{snapshot.items.length}</TableCell>
                      <TableCell>{formatDateTime(snapshot.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Bundle coverage"
            description="Aggregate snapshot and scope coverage."
            state={snapshots}
            tone="info"
            renderContent={(catalog) => (
              <Stack spacing={2}>
                <KeyValueList
                  items={[
                    { label: 'Snapshots', value: formatInteger(catalog.length) },
                    { label: 'Items', value: formatInteger(catalog.reduce((count, snapshot) => count + snapshot.items.length, 0)) },
                    { label: 'Runs', value: formatInteger(catalog.filter((snapshot) => snapshot.runId !== undefined).length) },
                  ]}
                />
                <Divider />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {Array.from(new Set(catalog.flatMap((snapshot) => snapshot.items.map((item) => item.scope)))).map((scope) => (
                    <StatusBadge key={scope} label={scope} tone="neutral" />
                  ))}
                </Stack>
              </Stack>
            )}
          />

          <LoadableCard
            title="Reference detail"
            description="Recent snapshot references and item counts."
            state={snapshots}
            tone="neutral"
            renderContent={(catalog) => (
              <Stack spacing={1}>
                {catalog.slice(0, 5).map((snapshot) => (
                  <KeyValueList
                    key={snapshot.id}
                    items={[
                      { label: snapshot.id, value: snapshot.items.length.toString() },
                      { label: 'Scopes', value: compactList(Array.from(new Set(snapshot.items.map((item) => item.scope)))) },
                    ]}
                  />
                ))}
              </Stack>
            )}
          />
        </Box>
      </Stack>
    </PageContainer>
  );
}
