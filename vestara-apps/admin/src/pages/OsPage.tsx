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
import type { OsProfileView } from '../api/contracts.js';

function profileItems(profile: OsProfileView) {
  return [
    { label: 'Hostname', value: profile.identity.hostname },
    { label: 'Distribution', value: `${profile.distribution.id} · ${profile.distribution.packageManager}` },
    { label: 'Kernel', value: profile.kernel.release },
    { label: 'Architecture', value: profile.identity.architecture },
    { label: 'Startup target', value: profile.startup.target },
    { label: 'Login provider', value: profile.login.provider },
    { label: 'Desktop', value: profile.desktop.environment },
    { label: 'Theme', value: profile.desktop.theme },
    { label: 'Locale', value: profile.locale.locale },
    { label: 'Timezone', value: profile.locale.timezone },
    { label: 'Update channel', value: profile.updates.channel },
    { label: 'Recovery', value: profile.recovery.enabled ? 'Enabled' : 'Disabled' },
  ] as const;
}

export function OsPage() {
  const client = useAdminApiClient();

  const current = useAsyncState((signal) => client.getOsCurrent(signal), [client]);
  const desired = useAsyncState((signal) => client.getOsDesired(signal), [client]);
  const state = useAsyncState((signal) => client.getOsState(signal), [client]);
  const diff = useAsyncState((signal) => client.getOsDiff(signal), [client]);
  const plan = useAsyncState((signal) => client.getOsPlan(signal), [client]);
  const capabilities = useAsyncState((signal) => client.listOsCapabilities(signal), [client]);

  return (
    <PageContainer
      title="OS"
      description="Captured vs desired OS state, drift analysis, and governed change planning."
      actions={<StatusBadge label={state.data ? `Drift ${state.data.driftCount}` : 'Loading'} tone={state.data && state.data.driftCount > 0 ? 'warning' : 'healthy'} />}
    >
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Platform' }, { label: 'OS' }]} />

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
          <MetricCard label="Drift" value={formatInteger(state.data?.driftCount)} detail="Current vs desired" tone={state.data && state.data.driftCount > 0 ? 'warning' : 'healthy'} />
          <MetricCard label="Desired revision" value={desired.data ? formatInteger(desired.data.revision) : '—'} detail={desired.data ? formatDateTime(desired.data.updatedAt) : 'No desired profile'} tone="info" />
          <MetricCard label="Plan risk" value={plan.data?.totalRisk ?? '—'} detail={plan.data ? `Requires approval: ${plan.data.requiresApproval ? 'Yes' : 'No'}` : 'Plan not generated'} tone={plan.data && plan.data.requiresApproval ? 'warning' : 'neutral'} />
          <MetricCard label="Capabilities" value={formatInteger(capabilities.data?.length)} detail="OS control surface" tone="healthy" />
          <MetricCard label="Changes" value={formatInteger(plan.data?.changes.length)} detail="Planned mutations" tone="info" />
          <MetricCard label="Current state" value={current.data?.lifecycle.state ?? '—'} detail={formatDateTime(current.data?.capturedAt)} tone={toneForStatus(current.data?.lifecycle.state)} />
          <MetricCard label="Kernel" value={current.data?.profile.kernel.release ?? '—'} detail={current.data?.profile.identity.hostname ?? 'Awaiting current profile'} tone="neutral" />
          <MetricCard label="Capability gating" value={plan.data ? (plan.data.requiresReboot ? 'Reboot' : 'No reboot') : '—'} detail={plan.data ? (plan.data.requiresApproval ? 'Approval required' : 'No approval required') : 'Waiting'} tone={plan.data?.requiresApproval ? 'warning' : 'healthy'} />
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
            title="Current profile"
            description="Captured operating profile and lifecycle state."
            state={current}
            tone="info"
            renderContent={(view) => (
              <Stack spacing={2}>
                <KeyValueList items={[{ label: 'Lifecycle state', value: view.lifecycle.state }, { label: 'Since', value: formatDateTime(view.lifecycle.since) }, { label: 'Captured', value: formatDateTime(view.capturedAt) }]} />
                <Divider />
                <KeyValueList items={profileItems(view.profile)} />
                <Divider />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  <StatusBadge label={view.profile.kernel.updatePolicy} tone="info" />
                  <StatusBadge label={view.profile.security.lockdown} tone="warning" />
                  <StatusBadge label={view.profile.login.allowAutoLogin ? 'Auto-login enabled' : 'Auto-login disabled'} tone={view.profile.login.allowAutoLogin ? 'warning' : 'healthy'} />
                </Stack>
              </Stack>
            )}
          />

          <LoadableCard
            title="Desired profile"
            description="Revisioned target state. May be absent until declared."
            state={desired}
            tone="healthy"
            renderContent={(view) => {
              if (view === undefined) return null;

              return (
                <Stack spacing={2}>
                  <KeyValueList items={[{ label: 'Revision', value: view.revision }, { label: 'Updated', value: formatDateTime(view.updatedAt) }]} />
                  <Divider />
                  <KeyValueList items={profileItems(view.profile)} />
                </Stack>
              );
            }}
          />

          <LoadableCard
            title="Plan"
            description="Compiled OS change plan, including approval and reboot requirements."
            state={plan}
            tone="warning"
            renderContent={(view) => (
              <Stack spacing={2}>
                <KeyValueList
                  items={[
                    { label: 'Plan id', value: view.planId },
                    { label: 'Hash', value: view.planHash },
                    { label: 'Risk', value: view.totalRisk },
                    { label: 'Requires approval', value: view.requiresApproval ? 'Yes' : 'No' },
                    { label: 'Requires reboot', value: view.requiresReboot ? 'Yes' : 'No' },
                    { label: 'Generated', value: formatDateTime(view.generatedAt) },
                  ]}
                />
                <Divider />
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Category</TableCell>
                      <TableCell>Target</TableCell>
                      <TableCell>Risk</TableCell>
                      <TableCell>Approval</TableCell>
                      <TableCell>Reboot</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {view.changes.map((change) => (
                      <TableRow key={change.id}>
                        <TableCell sx={{ fontWeight: 600 }}>{change.category}</TableCell>
                        <TableCell>{change.target}</TableCell>
                        <TableCell>
                          <StatusBadge label={change.risk} tone={toneForStatus(change.risk)} />
                        </TableCell>
                        <TableCell>{change.requiresApproval ? 'Yes' : 'No'}</TableCell>
                        <TableCell>{change.requiresReboot ? 'Yes' : 'No'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Stack>
            )}
          />

          <LoadableCard
            title="Drift"
            description="Entry-level diff between captured and desired state."
            state={diff}
            tone={diff.data && diff.data.driftCount > 0 ? 'warning' : 'healthy'}
            renderContent={(view) => (
              <Stack spacing={2}>
                <KeyValueList items={[{ label: 'Drift count', value: view.driftCount }, { label: 'Generated', value: formatDateTime(view.generatedAt) }]} />
                <Divider />
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Category</TableCell>
                      <TableCell>Key</TableCell>
                      <TableCell>From</TableCell>
                      <TableCell>To</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {view.entries.map((entry) => (
                      <TableRow key={`${entry.category}:${entry.key}`}>
                        <TableCell sx={{ fontWeight: 600 }}>{entry.category}</TableCell>
                        <TableCell>{entry.key}</TableCell>
                        <TableCell>{entry.from === undefined ? '—' : JSON.stringify(entry.from)}</TableCell>
                        <TableCell>{entry.to === undefined ? '—' : JSON.stringify(entry.to)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Stack>
            )}
          />

          <LoadableCard
            title="Capabilities"
            description="OS actions with risk and approval gates."
            state={capabilities}
            tone="healthy"
            renderContent={(capabilityList) => (
              <Stack spacing={2}>
                <KeyValueList items={[{ label: 'Capability count', value: formatInteger(capabilityList.length) }, { label: 'Approval required', value: formatInteger(capabilityList.filter((capability) => capability.requiresApproval).length) }]} />
                <Divider />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {capabilityList.map((capability) => (
                    <StatusBadge key={capability.id} label={`${capability.kind} · ${capability.risk}`} tone={toneForStatus(capability.risk)} />
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
