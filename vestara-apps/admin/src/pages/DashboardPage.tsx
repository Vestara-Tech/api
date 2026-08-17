import { Box, Divider, Stack, Typography } from '@mui/material';

import { PageContainer, StatusBadge, useVestaraThemeSnapshot } from '@vestara/ui';

import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { useAdminApiClient } from '../app/hooks/useAdminApiClient.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { useCapabilityNavigation } from '../app/navigation/CapabilityNavigationProvider.js';
import { compactList, formatDateTime, formatDurationMs, formatInteger } from '../app/utils/format.js';
import { toneForStatus } from '../app/utils/status.js';

export function DashboardPage() {
  const client = useAdminApiClient();
  const themeSnapshot = useVestaraThemeSnapshot();
  const navigation = useCapabilityNavigation();

  const startup = useAsyncState((signal) => client.getStartupSnapshot(signal), [client]);
  const system = useAsyncState((signal) => client.getSystemStatus(signal), [client]);
  const agents = useAsyncState((signal) => client.listAgents(signal), [client]);
  const workflows = useAsyncState((signal) => client.listWorkflows(signal), [client]);
  const tasks = useAsyncState((signal) => client.listTasks(signal), [client]);
  const diagnostics = useAsyncState((signal) => client.listDiagnosticRuns(signal), [client]);
  const logs = useAsyncState((signal) => client.getLogStats(signal), [client]);

  const themeTone = themeSnapshot.source === 'remote' ? 'healthy' : 'warning';
  const capabilityTone = navigation.status === 'ready' ? 'healthy' : navigation.status === 'error' ? 'warning' : 'neutral';
  const startupStatus = startup.data?.state.status;

  return (
    <PageContainer
      title="Dashboard"
      description="Live platform overview across startup, system, agents, workflows, tasks, diagnostics, and logs."
      actions={
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <StatusBadge label={themeSnapshot.source === 'remote' ? 'Theme synced' : 'Theme fallback'} tone={themeTone} />
          <StatusBadge
            label={navigation.status === 'ready' ? 'Capabilities ready' : navigation.status === 'error' ? 'Capabilities offline' : 'Capabilities loading'}
            tone={capabilityTone}
          />
        </Stack>
      }
    >
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Overview' }, { label: 'Dashboard' }]} />

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
          <MetricCard label="Theme" value={themeSnapshot.themeId} detail={themeSnapshot.source} tone={themeTone} />
          <MetricCard label="Capabilities" value={formatInteger(navigation.enabledCapabilities.size)} detail="Enabled registry entries" tone={capabilityTone} />
          <MetricCard label="Startup" value={startup.data?.state.status ?? '—'} detail={startup.data?.state.destination ?? 'Waiting for startup data'} tone={toneForStatus(startupStatus)} />
          <MetricCard label="Uptime" value={formatDurationMs(system.data?.uptimeMs)} detail={formatDateTime(system.data?.startedAt)} tone="info" />
          <MetricCard label="Agents" value={formatInteger(agents.data?.length)} detail="Operational agents discovered" tone="healthy" />
          <MetricCard label="Workflows" value={formatInteger(workflows.data?.length)} detail="Registered workflows" tone="healthy" />
          <MetricCard label="Tasks" value={formatInteger(tasks.data?.length)} detail="Tracked work items" tone="info" />
          <MetricCard label="Logs" value={formatInteger(logs.data?.total)} detail="Structured log records" tone="neutral" />
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
            title="Startup"
            description="Bootstrap state, routing destination, and readiness progress."
            state={startup}
            tone={toneForStatus(startupStatus)}
            renderContent={(snapshot) => (
              <Stack spacing={2}>
                <KeyValueList
                  items={[
                    { label: 'Status', value: snapshot.state.status },
                    { label: 'Destination', value: snapshot.state.destination },
                    { label: 'Authenticated', value: snapshot.state.authenticated ? 'Yes' : 'No' },
                    { label: 'Session ready', value: snapshot.state.sessionReady ? 'Yes' : 'No' },
                    { label: 'First boot', value: snapshot.state.firstBoot ? 'Yes' : 'No' },
                    { label: 'Ready at', value: formatDateTime(snapshot.state.readyAt) },
                  ]}
                />
                <Divider />
                <Stack spacing={1}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Service readiness
                  </Typography>
                  <Stack spacing={1}>
                    {snapshot.services.map((service) => (
                      <Stack key={service.serviceId} direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {service.serviceId}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {service.detail ?? 'Ready state reported by startup coordinator'}
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <StatusBadge label={service.readiness} tone={toneForStatus(service.readiness)} />
                          <Typography variant="caption" color="text.secondary">
                            {formatDateTime(service.updatedAt)}
                          </Typography>
                        </Stack>
                      </Stack>
                    ))}
                  </Stack>
                </Stack>
              </Stack>
            )}
          />

          <LoadableCard
            title="Platform"
            description="Service identity and backend contract status."
            state={system}
            tone="info"
            renderContent={(status) => (
              <Stack spacing={2}>
                <KeyValueList
                  items={[
                    { label: 'Service', value: status.service },
                    { label: 'API version', value: status.apiVersion },
                    { label: 'Contract version', value: status.contractVersion },
                    { label: 'Started at', value: formatDateTime(status.startedAt) },
                    { label: 'Uptime', value: formatDurationMs(status.uptimeMs) },
                    { label: 'Capabilities', value: compactList(status.capabilities) },
                  ]}
                />
                <Divider />
                <Stack spacing={1}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Capability sample
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    {status.capabilities.slice(0, 8).map((capability) => (
                      <StatusBadge key={capability} label={capability} tone="healthy" />
                    ))}
                  </Stack>
                </Stack>
              </Stack>
            )}
          />

          <LoadableCard
            title="Agents"
            description="Operational agent catalog and execution footprint."
            state={agents}
            tone="healthy"
            renderContent={(catalog) => (
              <Stack spacing={2}>
                <KeyValueList
                  items={[
                    { label: 'Agents', value: formatInteger(catalog.length) },
                    { label: 'Tools', value: formatInteger((catalog as readonly { readonly tools: readonly { readonly id: string }[] }[]).reduce((total, agent) => total + agent.tools.length, 0)) },
                    { label: 'Skills', value: formatInteger((catalog as readonly { readonly skills: readonly { readonly id: string }[] }[]).reduce((total, agent) => total + agent.skills.length, 0)) },
                  ]}
                />
                <Divider />
                <Stack spacing={1}>
                  {catalog.slice(0, 5).map((agent) => (
                    <Stack key={agent.id} direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {agent.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {agent.role} · {agent.version}
                        </Typography>
                      </Stack>
                      <StatusBadge label={`${agent.tools.length} tools`} tone="info" />
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            )}
          />

          <LoadableCard
            title="Workflows"
            description="Published workflow definitions and recent runs."
            state={workflows}
            tone="healthy"
            renderContent={(workflowCatalog) => (
              <Stack spacing={2}>
                <KeyValueList
                  items={[
                    { label: 'Workflows', value: formatInteger(workflowCatalog.length) },
                    { label: 'Published', value: formatInteger(workflowCatalog.filter((workflow) => workflow.status === 'published').length) },
                  ]}
                />
                <Divider />
                <Stack spacing={1}>
                  {workflowCatalog.slice(0, 5).map((workflow) => (
                    <Stack key={workflow.id} direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {workflow.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {workflow.id} · revision {workflow.revision}
                        </Typography>
                      </Stack>
                      <StatusBadge label={workflow.status} tone={toneForStatus(workflow.status)} />
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            )}
          />

          <LoadableCard
            title="Tasks"
            description="Tracked work items and progression state."
            state={tasks}
            tone="info"
            renderContent={(taskCatalog) => (
              <Stack spacing={2}>
                <KeyValueList
                  items={[
                    { label: 'Tasks', value: formatInteger(taskCatalog.length) },
                    { label: 'Open', value: formatInteger(taskCatalog.filter((task) => task.status !== 'done').length) },
                    { label: 'Blocked', value: formatInteger(taskCatalog.filter((task) => task.status.includes('block')).length) },
                  ]}
                />
                <Divider />
                <Stack spacing={1}>
                  {taskCatalog.slice(0, 5).map((task) => (
                    <Stack key={task.id} direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {task.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {task.type} · {task.priority}
                        </Typography>
                      </Stack>
                      <StatusBadge label={task.status} tone={toneForStatus(task.status)} />
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            )}
          />

          <LoadableCard
            title="Diagnostics"
            description="Recent diagnostic runs and findings."
            state={diagnostics}
            tone="warning"
            renderContent={(runs) => (
              <Stack spacing={2}>
                <KeyValueList
                  items={[
                    { label: 'Runs', value: formatInteger(runs.length) },
                    { label: 'Failed findings', value: formatInteger(runs.reduce((total, run) => total + run.counts.failed, 0)) },
                    { label: 'Degraded findings', value: formatInteger(runs.reduce((total, run) => total + run.counts.degraded, 0)) },
                  ]}
                />
                <Divider />
                <Stack spacing={1}>
                  {runs.slice(0, 4).map((run) => (
                    <Stack key={run.id} direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {run.scope}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {run.id} · {formatDateTime(run.startedAt)}
                        </Typography>
                      </Stack>
                      <StatusBadge label={run.status} tone={toneForStatus(run.status)} />
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            )}
          />

          <LoadableCard
            title="Logs"
            description="Structured log volume and error mix."
            state={logs}
            tone="neutral"
            renderContent={(stats) => (
              <Stack spacing={2}>
                <KeyValueList
                  items={[
                    { label: 'Total records', value: formatInteger(stats.total) },
                    { label: 'Error-level', value: formatInteger(stats.byLevel.error ?? 0) },
                    { label: 'Warn-level', value: formatInteger(stats.byLevel.warn ?? 0) },
                    { label: 'Info-level', value: formatInteger(stats.byLevel.info ?? 0) },
                  ]}
                />
                <Divider />
                <Stack spacing={1}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Source mix
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    {Object.entries(stats.bySource)
                      .slice(0, 8)
                      .map(([source, count]) => (
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
