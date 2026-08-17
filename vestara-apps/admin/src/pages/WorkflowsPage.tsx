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

export function WorkflowsPage() {
  const client = useAdminApiClient();

  const workflows = useAsyncState((signal) => client.listWorkflows(signal), [client]);
  const runs = useAsyncState((signal) => client.listWorkflowRuns(undefined, signal), [client]);

  return (
    <PageContainer title="Workflows" description="Workflow definitions, published status, and recent execution runs.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Platform' }, { label: 'Workflows' }]} />

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
          <MetricCard label="Workflows" value={formatInteger(workflows.data?.length)} detail="Registered definitions" tone="healthy" />
          <MetricCard label="Published" value={formatInteger(workflows.data?.filter((workflow) => workflow.status === 'published').length)} detail="Published workflows" tone="info" />
          <MetricCard label="Runs" value={formatInteger(runs.data?.length)} detail="Workflow executions" tone="warning" />
          <MetricCard label="Failed runs" value={formatInteger(runs.data?.filter((run) => run.status === 'failed').length)} detail="Execution failures" tone="warning" />
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
            title="Workflow definitions"
            description="Versioned workflows with inputs, steps, and lifecycle state."
            state={workflows}
            tone="healthy"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Version</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Inputs</TableCell>
                    <TableCell>Steps</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((workflow) => (
                    <TableRow key={workflow.id}>
                      <TableCell sx={{ fontWeight: 600 }}>
                        <Stack spacing={0.25}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {workflow.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {workflow.id}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{workflow.version}</TableCell>
                      <TableCell>
                        <StatusBadge label={workflow.status} tone={toneForStatus(workflow.status)} />
                      </TableCell>
                      <TableCell>{workflow.inputs.length}</TableCell>
                      <TableCell>{workflow.steps.length}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Workflow runs"
            description="Recent execution history and current execution state."
            state={runs}
            tone="warning"
            renderContent={(catalog) => (
              <Stack spacing={2}>
                <KeyValueList items={[{ label: 'Runs', value: formatInteger(catalog.length) }, { label: 'Waiting', value: formatInteger(catalog.filter((run) => run.waitingOnStep !== undefined).length) }]} />
                <Divider />
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Workflow</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Steps</TableCell>
                      <TableCell>Started</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {catalog.slice(0, 20).map((run) => (
                      <TableRow key={run.id}>
                        <TableCell sx={{ fontWeight: 600 }}>
                          <Stack spacing={0.25}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {run.workflowId}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {run.id}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <StatusBadge label={run.status} tone={toneForStatus(run.status)} />
                        </TableCell>
                        <TableCell>{run.steps.length}</TableCell>
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
