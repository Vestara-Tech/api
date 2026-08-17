import { Box, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { PageContainer, StatusBadge } from '@vestara/ui';

import { MetricCard } from '../app/components/MetricCard.js';
import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { useAdminApiClient } from '../app/hooks/useAdminApiClient.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { formatDateTime, formatInteger } from '../app/utils/format.js';
import { toneForStatus } from '../app/utils/status.js';

type NotificationEntry =
  | {
      readonly at: string;
      readonly category: string;
      readonly source: string;
      readonly title: string;
      readonly detail: string;
      readonly severity: string;
    };

function toTimestamp(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function NotificationsPage() {
  const client = useAdminApiClient();

  const logs = useAsyncState((signal) => client.listLogTail(50, signal), [client]);
  const diagnostics = useAsyncState((signal) => client.listDiagnosticRuns(signal), [client]);

  const notifications: readonly NotificationEntry[] = [
    ...(logs.data ?? [])
      .filter((record) => ['warn', 'error', 'fatal'].includes(record.level))
      .map((record) => ({
        at: record.timestamp,
        category: 'log',
        source: `${record.source.type}:${record.source.id}`,
        title: record.level,
        detail: record.message,
        severity: record.level,
      })),
    ...(diagnostics.data ?? [])
      .flatMap((run) =>
        run.findings
          .filter((finding) => ['failed', 'critical'].includes(finding.status) || ['high', 'critical'].includes(finding.severity))
          .map((finding) => ({
            at: finding.at,
            category: 'diagnostic',
            source: run.scope,
            title: finding.checkId,
            detail: finding.message,
            severity: finding.severity,
          })),
      ),
  ]
    .sort((left, right) => toTimestamp(right.at) - toTimestamp(left.at))
    .slice(0, 30);

  return (
    <PageContainer title="Notifications" description="Warnings, alerts, and high-severity operational findings.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Overview' }, { label: 'Notifications' }]} />

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
            },
          }}
        >
          <MetricCard label="Warnings" value={formatInteger((logs.data ?? []).filter((record) => record.level === 'warn').length)} detail="Warning-level logs" tone="warning" />
          <MetricCard label="Errors" value={formatInteger((logs.data ?? []).filter((record) => ['error', 'fatal'].includes(record.level)).length)} detail="Error-level logs" tone="critical" />
          <MetricCard label="Diagnostic findings" value={formatInteger(diagnostics.data?.reduce((total, run) => total + run.findings.length, 0))} detail="All findings in recent runs" tone="warning" />
          <MetricCard label="High severity" value={formatInteger(notifications.length)} detail="Notifications surfaced in this view" tone="warning" />
        </Box>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>At</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Message</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {notifications.map((entry, index) => (
              <TableRow key={`${entry.category}:${entry.source}:${entry.at}:${index}`}>
                <TableCell>{formatDateTime(entry.at)}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{entry.category}</TableCell>
                <TableCell>{entry.source}</TableCell>
                <TableCell>
                  <StatusBadge label={entry.severity} tone={toneForStatus(entry.severity)} />
                </TableCell>
                <TableCell>
                  <Stack spacing={0.25}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {entry.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {entry.detail}
                    </Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Stack>
    </PageContainer>
  );
}
