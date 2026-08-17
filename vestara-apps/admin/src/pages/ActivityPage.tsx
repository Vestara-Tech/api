import { Box, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { PageContainer, StatusBadge } from '@vestara/ui';

import { MetricCard } from '../app/components/MetricCard.js';
import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { useAdminApiClient } from '../app/hooks/useAdminApiClient.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { formatDateTime, formatInteger } from '../app/utils/format.js';
import { toneForStatus } from '../app/utils/status.js';

type ActivityEntry =
  | {
      readonly kind: 'log';
      readonly at: string;
      readonly source: string;
      readonly title: string;
      readonly detail: string;
      readonly status: string;
    }
  | {
      readonly kind: 'task';
      readonly at: string;
      readonly source: string;
      readonly title: string;
      readonly detail: string;
      readonly status: string;
    }
  | {
      readonly kind: 'diagnostic';
      readonly at: string;
      readonly source: string;
      readonly title: string;
      readonly detail: string;
      readonly status: string;
    };

function toTimestamp(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function ActivityPage() {
  const client = useAdminApiClient();

  const logs = useAsyncState((signal) => client.listLogTail(25, signal), [client]);
  const events = useAsyncState((signal) => client.listTaskEvents(signal), [client]);
  const diagnostics = useAsyncState((signal) => client.listDiagnosticRuns(signal), [client]);
  const workflows = useAsyncState((signal) => client.listWorkflowRuns(undefined, signal), [client]);

  const activities: readonly ActivityEntry[] = [
    ...(logs.data ?? []).map((record) => ({
      kind: 'log' as const,
      at: record.timestamp,
      source: `${record.source.type}:${record.source.id}`,
      title: record.level,
      detail: record.message,
      status: record.level,
    })),
    ...(events.data ?? []).map((event) => ({
      kind: 'task' as const,
      at: event.at,
      source: event.taskId,
      title: event.type,
      detail: 'Task lifecycle event',
      status: event.type,
    })),
    ...(diagnostics.data ?? []).map((run) => ({
      kind: 'diagnostic' as const,
      at: run.startedAt,
      source: run.scope,
      title: run.status,
      detail: `${run.counts.failed} failed, ${run.counts.degraded} degraded`,
      status: run.status,
    })),
  ]
    .sort((left, right) => toTimestamp(right.at) - toTimestamp(left.at))
    .slice(0, 25);

  return (
    <PageContainer title="Activity" description="Recent platform activity across logs, tasks, diagnostics, and workflows.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Overview' }, { label: 'Activity' }]} />

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
          <MetricCard label="Logs" value={formatInteger(logs.data?.length)} detail="Recent log tail" tone="neutral" />
          <MetricCard label="Task events" value={formatInteger(events.data?.length)} detail="Recent task events" tone="info" />
          <MetricCard label="Diagnostic runs" value={formatInteger(diagnostics.data?.length)} detail="Recent diagnostic activity" tone="warning" />
          <MetricCard label="Workflow runs" value={formatInteger(workflows.data?.length)} detail="Recent workflow executions" tone="healthy" />
        </Box>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>At</TableCell>
              <TableCell>Kind</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Detail</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {activities.map((activity, index) => (
              <TableRow key={`${activity.kind}:${activity.source}:${activity.at}:${index}`}>
                <TableCell>{formatDateTime(activity.at)}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{activity.kind}</TableCell>
                <TableCell>{activity.source}</TableCell>
                <TableCell>
                  <StatusBadge label={activity.status} tone={toneForStatus(activity.status)} />
                </TableCell>
                <TableCell>{activity.detail}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Stack>
    </PageContainer>
  );
}
