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

export function DiagnosticsPage() {
  const client = useAdminApiClient();

  const checks = useAsyncState((signal) => client.listDiagnosticChecks(signal), [client]);
  const runs = useAsyncState((signal) => client.listDiagnosticRuns(signal), [client]);

  return (
    <PageContainer title="Diagnostics" description="Checks, execution runs, and findings across the platform.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Operations' }, { label: 'Diagnostics' }]} />

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
          <MetricCard label="Checks" value={formatInteger(checks.data?.length)} detail="Registered diagnostic checks" tone="healthy" />
          <MetricCard label="Runs" value={formatInteger(runs.data?.length)} detail="Diagnostic executions" tone="warning" />
          <MetricCard label="Failed findings" value={formatInteger(runs.data?.reduce((total, run) => total + run.counts.failed, 0))} detail="High-priority failures" tone="critical" />
          <MetricCard label="Degraded findings" value={formatInteger(runs.data?.reduce((total, run) => total + run.counts.degraded, 0))} detail="Degraded checks" tone="warning" />
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
            title="Diagnostic checks"
            description="Registered checks and their module association."
            state={checks}
            tone="healthy"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Risk</TableCell>
                    <TableCell>Module</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((check) => (
                    <TableRow key={check.checkId}>
                      <TableCell sx={{ fontWeight: 600 }}>{check.name}</TableCell>
                      <TableCell>{check.category}</TableCell>
                      <TableCell>
                        <StatusBadge label={check.risk} tone={toneForStatus(check.risk)} />
                      </TableCell>
                      <TableCell>{check.moduleId}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Diagnostic runs"
            description="Recent diagnostic run results and findings."
            state={runs}
            tone="warning"
            renderContent={(catalog) => (
              <Stack spacing={2}>
                <KeyValueList items={[{ label: 'Healthy', value: formatInteger(catalog.reduce((total, run) => total + run.counts.healthy, 0)) }, { label: 'Failed', value: formatInteger(catalog.reduce((total, run) => total + run.counts.failed, 0)) }]} />
                <Divider />
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Scope</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Counts</TableCell>
                      <TableCell>Started</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {catalog.slice(0, 20).map((run) => (
                      <TableRow key={run.id}>
                        <TableCell sx={{ fontWeight: 600 }}>
                          <Stack spacing={0.25}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {run.scope}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {run.target ?? '—'}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <StatusBadge label={run.status} tone={toneForStatus(run.status)} />
                        </TableCell>
                        <TableCell>{`${run.counts.healthy}/${run.counts.degraded}/${run.counts.failed}`}</TableCell>
                        <TableCell>{formatDateTime(run.startedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Stack>
            )}
          />
        </Box>
      </Stack>
    </PageContainer>
  );
}
