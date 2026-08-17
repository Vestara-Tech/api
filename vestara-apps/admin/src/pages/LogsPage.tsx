import { Box, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { PageContainer, StatusBadge } from '@vestara/ui';

import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { useAdminApiClient } from '../app/hooks/useAdminApiClient.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { formatDateTime, formatInteger } from '../app/utils/format.js';
import { toneForStatus } from '../app/utils/status.js';

export function LogsPage() {
  const client = useAdminApiClient();

  const stats = useAsyncState((signal) => client.getLogStats(signal), [client]);
  const tail = useAsyncState((signal) => client.listLogTail(50, signal), [client]);
  const sources = useAsyncState((signal) => client.listLogSources(signal), [client]);

  return (
    <PageContainer title="Logs" description="Structured log records, sources, and aggregate log volume.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Operations' }, { label: 'Logs' }]} />

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
          <MetricCard label="Total" value={formatInteger(stats.data?.total)} detail="Structured log records" tone="neutral" />
          <MetricCard label="Error" value={formatInteger(stats.data?.byLevel.error ?? 0)} detail="Error-level records" tone="critical" />
          <MetricCard label="Warn" value={formatInteger(stats.data?.byLevel.warn ?? 0)} detail="Warning-level records" tone="warning" />
          <MetricCard label="Sources" value={formatInteger(sources.data?.length)} detail="Log source inventory" tone="info" />
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
            title="Log tail"
            description="Recent structured records across the platform."
            state={tail}
            tone="neutral"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Level</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Message</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.slice(0, 25).map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{formatDateTime(record.timestamp)}</TableCell>
                      <TableCell>
                        <StatusBadge label={record.level} tone={toneForStatus(record.level)} />
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.25}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {record.source.id}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {record.source.type}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{record.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Log sources"
            description="Registered source identifiers and source mix."
            state={sources}
            tone="info"
            renderContent={(catalog) => (
              <Stack spacing={2}>
                <KeyValueList items={[{ label: 'Sources', value: formatInteger(catalog.length) }]} />
                <Divider />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {catalog.map((source) => (
                    <StatusBadge key={source} label={source} tone="neutral" />
                  ))}
                </Stack>
                <Divider />
                <Stack spacing={1}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Level breakdown
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    {Object.entries(stats.data?.byLevel ?? {}).map(([level, count]) => (
                      <StatusBadge key={level} label={`${level}: ${count}`} tone={toneForStatus(level)} />
                    ))}
                  </Stack>
                </Stack>
                <Divider />
                <Stack spacing={1}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Source breakdown
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    {Object.entries(stats.data?.bySource ?? {}).slice(0, 12).map(([source, count]) => (
                      <StatusBadge key={source} label={`${source}: ${count}`} tone="neutral" />
                    ))}
                  </Stack>
                </Stack>
              </Stack>
            )}
          />
        </Box>
      </Stack>
    </PageContainer>
  );
}
