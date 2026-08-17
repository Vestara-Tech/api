import { Box, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { PageContainer, StatusBadge } from '@vestara/ui';

import { KeyValueList } from '../app/components/KeyValueList.js';
import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { useAdminApiClient } from '../app/hooks/useAdminApiClient.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { formatBytes, formatDateTime, formatDurationMs, formatInteger } from '../app/utils/format.js';
import { toneForStatus } from '../app/utils/status.js';

export function SystemPage() {
  const client = useAdminApiClient();

  const systemStatus = useAsyncState((signal) => client.getSystemStatus(signal), [client]);
  const snapshot = useAsyncState((signal) => client.getSystemSnapshot(signal), [client]);
  const services = useAsyncState((signal) => client.listSystemServices(signal), [client]);
  const processes = useAsyncState((signal) => client.listSystemProcesses(signal), [client]);
  const kernel = useAsyncState((signal) => client.getSystemKernel(signal), [client]);
  const storage = useAsyncState((signal) => client.getSystemStorage(signal), [client]);
  const operations = useAsyncState((signal) => client.listSystemOperations(signal), [client]);
  const approvals = useAsyncState((signal) => client.listSystemApprovals(signal), [client]);

  return (
    <PageContainer
      title="System"
      description="Hardware inventory, runtime services, storage, and governed operation journal."
      actions={<StatusBadge label={systemStatus.data ? systemStatus.data.service : 'Loading system'} tone={systemStatus.data ? 'healthy' : 'neutral'} />}
    >
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Platform' }, { label: 'System' }]} />

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
          <MetricCard label="Uptime" value={formatDurationMs(systemStatus.data?.uptimeMs)} detail={formatDateTime(systemStatus.data?.startedAt)} tone="info" />
          <MetricCard label="CPU cores" value={formatInteger(snapshot.data?.cpu.logicalCores)} detail={snapshot.data?.cpu.status ?? 'CPU status'} tone={toneForStatus(snapshot.data?.cpu.status)} />
          <MetricCard label="Memory" value={formatBytes(snapshot.data?.memory.totalBytes)} detail={snapshot.data?.memory.status ?? 'Memory status'} tone={toneForStatus(snapshot.data?.memory.status)} />
          <MetricCard label="Services" value={formatInteger(services.data?.length)} detail="Runtime services" tone="healthy" />
          <MetricCard label="Processes" value={formatInteger(processes.data?.length)} detail="Observed processes" tone="info" />
          <MetricCard label="Disks" value={formatInteger(storage.data?.disks.length)} detail={formatBytes(snapshot.data?.storage.totalBytes)} tone="warning" />
          <MetricCard label="Operations" value={formatInteger(operations.data?.length)} detail="Journal entries" tone="neutral" />
          <MetricCard label="Approvals" value={formatInteger(approvals.data?.length)} detail="Pending and historical approvals" tone="warning" />
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
            title="Inventory"
            description="Captured host, operating system, firmware, and runtime state."
            state={snapshot}
            tone="info"
            renderContent={(data) => (
              <Stack spacing={2}>
                <KeyValueList
                  items={[
                    { label: 'Hostname', value: data.identity.hostname },
                    { label: 'Operating system', value: `${data.operatingSystem.name} ${data.operatingSystem.version}` },
                    { label: 'Kernel', value: data.operatingSystem.kernel },
                    { label: 'Architecture', value: data.operatingSystem.architecture },
                    { label: 'Boot mode', value: data.operatingSystem.bootMode },
                    { label: 'Firmware', value: data.firmware.mode },
                    { label: 'Captured', value: formatDateTime(data.capturedAt) },
                    { label: 'Storage status', value: data.storage.status },
                    { label: 'Network status', value: data.network.status },
                    { label: 'Power status', value: data.power.status },
                    { label: 'Thermal status', value: data.thermal.status },
                    { label: 'Filesystem status', value: data.filesystems.status },
                  ]}
                />
                <Divider />
                <Stack spacing={1}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Operating system capabilities
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    <StatusBadge label={data.cpu.status} tone={toneForStatus(data.cpu.status)} />
                    <StatusBadge label={data.memory.status} tone={toneForStatus(data.memory.status)} />
                    <StatusBadge label={data.storage.status} tone={toneForStatus(data.storage.status)} />
                    <StatusBadge label={data.network.status} tone={toneForStatus(data.network.status)} />
                    <StatusBadge label={data.kernel.status} tone={toneForStatus(data.kernel.status)} />
                    <StatusBadge label={data.boot.status} tone={toneForStatus(data.boot.status)} />
                  </Stack>
                </Stack>
              </Stack>
            )}
          />

          <LoadableCard
            title="Services"
            description="Systemd services and their runtime state."
            state={services}
            tone="healthy"
            renderContent={(serviceCatalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Enabled</TableCell>
                    <TableCell>PID</TableCell>
                    <TableCell>Description</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {serviceCatalog.map((service) => (
                    <TableRow key={service.name}>
                      <TableCell sx={{ fontWeight: 600 }}>{service.name}</TableCell>
                      <TableCell>
                        <StatusBadge label={service.status} tone={toneForStatus(service.status)} />
                      </TableCell>
                      <TableCell>{service.enabled === undefined ? '—' : service.enabled ? 'Yes' : 'No'}</TableCell>
                      <TableCell>{service.pid ?? '—'}</TableCell>
                      <TableCell>{service.description ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Processes"
            description="Observed processes and memory footprint."
            state={processes}
            tone="info"
            renderContent={(processCatalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>PID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Memory</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {processCatalog.slice(0, 20).map((process) => (
                    <TableRow key={process.pid}>
                      <TableCell sx={{ fontWeight: 600 }}>{process.pid}</TableCell>
                      <TableCell>{process.name}</TableCell>
                      <TableCell>{formatBytes(process.memoryBytes)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Kernel"
            description="Kernel release and loaded module health."
            state={kernel}
            tone="healthy"
            renderContent={(kernelData) => (
              <Stack spacing={2}>
                <KeyValueList
                  items={[
                    { label: 'Release', value: kernelData.release },
                    { label: 'Status', value: kernelData.status },
                    { label: 'Loaded modules', value: formatInteger(kernelData.modules.length) },
                  ]}
                />
                <Divider />
                <Stack spacing={1}>
                  {kernelData.modules.map((module) => (
                    <Stack key={module.name} direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {module.name}
                      </Typography>
                      <StatusBadge label={module.status} tone={toneForStatus(module.status)} />
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            )}
          />

          <LoadableCard
            title="Storage"
            description="Disks and mounts."
            state={storage}
            tone="warning"
            renderContent={(storageData) => (
              <Stack spacing={2}>
                <Stack spacing={1}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Disks
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Size</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {storageData.disks.map((disk) => (
                        <TableRow key={disk.name}>
                          <TableCell sx={{ fontWeight: 600 }}>{disk.name}</TableCell>
                          <TableCell>{disk.type ?? '—'}</TableCell>
                          <TableCell>{formatBytes(disk.sizeBytes)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Stack>
                <Divider />
                <Stack spacing={1}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Mounts
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Device</TableCell>
                        <TableCell>Mount point</TableCell>
                        <TableCell>Filesystem</TableCell>
                        <TableCell>Read-only</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {storageData.mounts.map((mount) => (
                        <TableRow key={`${mount.device}:${mount.mountPoint}`}>
                          <TableCell sx={{ fontWeight: 600 }}>{mount.device}</TableCell>
                          <TableCell>{mount.mountPoint}</TableCell>
                          <TableCell>{mount.filesystem}</TableCell>
                          <TableCell>{mount.readOnly ? 'Yes' : 'No'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Stack>
              </Stack>
            )}
          />

          <LoadableCard
            title="Operation journal"
            description="Typed privileged actions tracked through the approval workflow."
            state={operations}
            tone="warning"
            renderContent={(journal) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Kind</TableCell>
                    <TableCell>Target</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Risk</TableCell>
                    <TableCell>Requested by</TableCell>
                    <TableCell>Requested at</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {journal.slice(0, 20).map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell sx={{ fontWeight: 600 }}>{entry.kind}</TableCell>
                      <TableCell>{entry.target}</TableCell>
                      <TableCell>
                        <StatusBadge label={entry.status} tone={toneForStatus(entry.status)} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge label={entry.risk} tone={toneForStatus(entry.risk)} />
                      </TableCell>
                      <TableCell>{entry.requestedBy}</TableCell>
                      <TableCell>{formatDateTime(entry.requestedAt)}</TableCell>
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
