import { Box, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { PageContainer, StatusBadge } from '@vestara/ui';

import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { useAdminApiClient } from '../app/hooks/useAdminApiClient.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { compactList, formatDateTime, formatInteger } from '../app/utils/format.js';
import { toneForStatus } from '../app/utils/status.js';

export function TasksPage() {
  const client = useAdminApiClient();

  const tasks = useAsyncState((signal) => client.listTasks(signal), [client]);
  const dependencyCheck = useAsyncState((signal) => client.validateTaskDependencies(signal), [client]);
  const events = useAsyncState((signal) => client.listTaskEvents(signal), [client]);

  return (
    <PageContainer title="Tasks" description="Tracked work items, dependency checks, and task events.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Platform' }, { label: 'Tasks' }]} />

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
          <MetricCard label="Tasks" value={formatInteger(tasks.data?.length)} detail="Tracked work items" tone="info" />
          <MetricCard label="Open" value={formatInteger(tasks.data?.filter((task) => task.status !== 'done').length)} detail="Incomplete work" tone="warning" />
          <MetricCard label="Blocked" value={formatInteger(tasks.data?.filter((task) => task.status.includes('block')).length)} detail="Blocked or waiting items" tone="warning" />
          <MetricCard label="Cycles" value={formatInteger(dependencyCheck.data?.cycles.length)} detail={dependencyCheck.data?.ok ? 'No dependency cycles' : 'Dependency cycles detected'} tone={dependencyCheck.data?.ok ? 'healthy' : 'critical'} />
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
            title="Task catalog"
            description="Task status, priority, assignment, and dependencies."
            state={tasks}
            tone="info"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Title</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell>Assignee</TableCell>
                    <TableCell>Dependencies</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell sx={{ fontWeight: 600 }}>
                        <Stack spacing={0.25}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {task.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {task.type} · {task.id}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <StatusBadge label={task.status} tone={toneForStatus(task.status)} />
                      </TableCell>
                      <TableCell>{task.priority}</TableCell>
                      <TableCell>{task.assignee ?? '—'}</TableCell>
                      <TableCell>{task.dependencies.length}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Dependency validation"
            description="Cycle detection for task dependencies."
            state={dependencyCheck}
            tone={dependencyCheck.data?.ok ? 'healthy' : 'warning'}
            renderContent={(result) => (
              <Stack spacing={2}>
                <KeyValueList items={[{ label: 'Valid', value: result.ok ? 'Yes' : 'No' }, { label: 'Cycles', value: formatInteger(result.cycles.length) }]} />
                <Divider />
                {result.cycles.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No dependency cycles detected.
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {result.cycles.map((cycle, index) => (
                      <StatusBadge key={`cycle-${index}`} label={compactList(cycle)} tone="warning" />
                    ))}
                  </Stack>
                )}
              </Stack>
            )}
          />

          <LoadableCard
            title="Task events"
            description="Recent task lifecycle events."
            state={events}
            tone="warning"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Task</TableCell>
                    <TableCell>Event</TableCell>
                    <TableCell>At</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.slice(0, 20).map((event) => (
                    <TableRow key={`${event.taskId}:${event.type}:${event.at}`}>
                      <TableCell sx={{ fontWeight: 600 }}>{event.taskId}</TableCell>
                      <TableCell>{event.type}</TableCell>
                      <TableCell>{formatDateTime(event.at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />
        </Box>
      </Stack>
    </PageContainer>
  );
}
