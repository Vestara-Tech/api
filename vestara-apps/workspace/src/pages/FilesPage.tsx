import { Box, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { PageContainer, StatusBadge, type StatusTone } from '@vestara/ui';

import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { useWorkspaceApiClient } from '../app/hooks/useWorkspaceApiClient.js';
import { compactList, formatDateTime, formatInteger } from '../app/utils/format.js';
import { summarizeFiles } from '../app/utils/summaries.js';

function providerTone(providerId: string): StatusTone {
  return providerId.length > 0 ? 'healthy' : 'neutral';
}

function eventTone(eventType: string): StatusTone {
  if (eventType.includes('error')) return 'critical';
  if (eventType.includes('apply') || eventType.includes('mount') || eventType.includes('write')) return 'healthy';
  return 'info';
}

export function FilesPage() {
  const client = useWorkspaceApiClient();
  const workspaces = useAsyncState((signal) => client.listFileWorkspaces(signal), [client]);
  const events = useAsyncState((signal) => client.listFileEvents(signal), [client]);
  const summary = summarizeFiles(workspaces.data ?? []);

  return (
    <PageContainer title="Files" description="Mounted file workspaces, provider coverage, and recent file events.">
      <Stack spacing={2.5}>
        <PageBreadcrumbs
          items={[
            { label: 'Workspace', href: '/workspace/overview' },
            { label: 'System' },
            { label: 'Files' },
          ]}
        />

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
          <MetricCard label="Workspaces" value={formatInteger(summary.totalWorkspaces)} detail="Mounted workspace mounts" />
          <MetricCard label="Providers" value={formatInteger(summary.providers)} detail="Unique file providers" />
          <MetricCard label="Include rules" value={formatInteger(summary.includeRules)} detail="Included path patterns" />
          <MetricCard label="Exclude rules" value={formatInteger(summary.excludeRules)} detail="Excluded path patterns" />
        </Box>

        <MetricCard label="Latest revision" value={formatInteger(summary.latestRevision)} detail="Highest mounted workspace revision" />

        <LoadableCard
          title="File workspaces"
          description="Workspace mounts and provider coverage."
          state={workspaces}
          renderContent={(data) => (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Root</TableCell>
                    <TableCell>Provider</TableCell>
                    <TableCell>Include</TableCell>
                    <TableCell>Exclude</TableCell>
                    <TableCell>Revision</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.length > 0 ? (
                    data.map((workspace) => (
                      <TableRow key={workspace.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {workspace.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {workspace.id}
                          </Typography>
                        </TableCell>
                        <TableCell>{workspace.root}</TableCell>
                        <TableCell>
                          <StatusBadge label={workspace.providerId} tone={providerTone(workspace.providerId)} />
                        </TableCell>
                        <TableCell>{compactList(workspace.include ?? [])}</TableCell>
                        <TableCell>{compactList(workspace.exclude ?? [])}</TableCell>
                        <TableCell>{workspace.revision}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography variant="body2" color="text.secondary">
                          No file workspaces have been mounted yet.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          )}
        />

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
            title="Selected workspace"
            description="Key coverage details for the first mounted workspace."
            state={workspaces}
            renderContent={(data) => {
              const workspace = data[0];

              if (workspace === undefined) {
                return (
                  <Typography variant="body2" color="text.secondary">
                    No workspace details available.
                  </Typography>
                );
              }

              return (
                <KeyValueList
                  items={[
                    { label: 'Name', value: workspace.name },
                    { label: 'Identifier', value: workspace.id },
                    { label: 'Root', value: workspace.root },
                    { label: 'Provider', value: <StatusBadge label={workspace.providerId} tone={providerTone(workspace.providerId)} /> },
                    { label: 'Include patterns', value: compactList(workspace.include ?? []) },
                    { label: 'Exclude patterns', value: compactList(workspace.exclude ?? []) },
                    { label: 'Revision', value: formatInteger(workspace.revision) },
                  ]}
                />
              );
            }}
          />

          <LoadableCard
            title="Recent file events"
            description="Event stream from the file control plane."
            state={events}
            renderContent={(data) => (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Workspace</TableCell>
                      <TableCell>Path</TableCell>
                      <TableCell>At</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.length > 0 ? (
                      data.map((event, index) => (
                        <TableRow key={`${event.type}:${event.at}:${index}`} hover>
                          <TableCell>
                            <StatusBadge label={event.type} tone={eventTone(event.type)} />
                          </TableCell>
                          <TableCell>{event.workspaceId ?? '—'}</TableCell>
                          <TableCell>{event.path ?? '—'}</TableCell>
                          <TableCell>{formatDateTime(event.at)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <Typography variant="body2" color="text.secondary">
                            No file events were returned.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>
            )}
          />
        </Box>
      </Stack>
    </PageContainer>
  );
}
