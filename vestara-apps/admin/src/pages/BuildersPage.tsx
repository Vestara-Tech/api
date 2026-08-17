import { Box, Stack, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';

import { PageContainer, StatusBadge } from '@vestara/ui';

import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { useAdminApiClient } from '../app/hooks/useAdminApiClient.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { compactList, formatDateTime, formatInteger } from '../app/utils/format.js';
import { toneForStatus } from '../app/utils/status.js';

export function BuildersPage() {
  const client = useAdminApiClient();

  const kinds = useAsyncState((signal) => client.listBuilderKinds(signal), [client]);
  const definitions = useAsyncState((signal) => client.listBuilderDefinitions(signal), [client]);
  const sessions = useAsyncState((signal) => client.listBuilderSessions(signal), [client]);

  return (
    <PageContainer title="Builders" description="Builder kinds, definitions, and active sessions.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Build' }, { label: 'Builders' }]} />

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(3, minmax(0, 1fr))',
            },
          }}
        >
          <MetricCard label="Kinds" value={formatInteger(kinds.data?.length)} detail="Registered builder kinds" tone="healthy" />
          <MetricCard label="Definitions" value={formatInteger(definitions.data?.length)} detail="Builder definitions" tone="info" />
          <MetricCard label="Sessions" value={formatInteger(sessions.data?.length)} detail="Active builder sessions" tone="warning" />
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
            title="Kinds"
            description="Capabilities contributed by builder-plane modules."
            state={kinds}
            tone="healthy"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Kind</TableCell>
                    <TableCell>Module</TableCell>
                    <TableCell>Version</TableCell>
                    <TableCell>Capabilities</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((kind) => (
                    <TableRow key={kind.kind}>
                      <TableCell sx={{ fontWeight: 600 }}>{kind.kind}</TableCell>
                      <TableCell>{kind.moduleId}</TableCell>
                      <TableCell>{kind.version}</TableCell>
                      <TableCell>{compactList(kind.capabilities)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Definitions"
            description="Current builder definitions and lifecycle state."
            state={definitions}
            tone="info"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Kind</TableCell>
                    <TableCell>Revision</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Updated</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((definition) => (
                    <TableRow key={definition.id}>
                      <TableCell sx={{ fontWeight: 600 }}>{definition.name}</TableCell>
                      <TableCell>{definition.kind}</TableCell>
                      <TableCell>{definition.revision}</TableCell>
                      <TableCell>
                        <StatusBadge label={definition.status} tone={toneForStatus(definition.status)} />
                      </TableCell>
                      <TableCell>{formatDateTime(definition.updatedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Sessions"
            description="Live builder sessions and draft identifiers."
            state={sessions}
            tone="warning"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Session</TableCell>
                    <TableCell>Draft</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Started</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((session) => (
                    <TableRow key={session.sessionId}>
                      <TableCell sx={{ fontWeight: 600 }}>{session.sessionId}</TableCell>
                      <TableCell>{session.draftId}</TableCell>
                      <TableCell>
                        <StatusBadge label={session.status} tone={toneForStatus(session.status)} />
                      </TableCell>
                      <TableCell>{formatDateTime(session.startedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Session footprint"
            description="Active session count and draft coverage."
            state={sessions}
            tone="neutral"
            renderContent={(catalog) => (
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {compactList(Array.from(new Set(catalog.map((session) => session.status))))}
              </Stack>
            )}
          />
        </Box>
      </Stack>
    </PageContainer>
  );
}
