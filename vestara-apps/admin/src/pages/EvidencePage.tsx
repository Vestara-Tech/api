import { Box, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';

import { PageContainer, StatusBadge } from '@vestara/ui';

import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { useAdminApiClient } from '../app/hooks/useAdminApiClient.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { formatDateTime, formatInteger } from '../app/utils/format.js';
import { toneForStatus } from '../app/utils/status.js';

export function EvidencePage() {
  const client = useAdminApiClient();

  const runtimes = useAsyncState((signal) => client.listBrowserRuntimes(signal), [client]);
  const profiles = useAsyncState((signal) => client.listBrowserProfiles(signal), [client]);
  const sessions = useAsyncState((signal) => client.listBrowserSessions(signal), [client]);
  const evidence = useAsyncState((signal) => client.listBrowserEvidence(signal), [client]);
  const testRuns = useAsyncState((signal) => client.listTestRuns(signal), [client]);

  return (
    <PageContainer title="Evidence" description="Verification evidence from browser and test execution.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Operations' }, { label: 'Evidence' }]} />

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
          <MetricCard label="Runtimes" value={formatInteger(runtimes.data?.length)} detail="Browser runtimes" tone="healthy" />
          <MetricCard label="Profiles" value={formatInteger(profiles.data?.length)} detail="Browser profiles" tone="info" />
          <MetricCard label="Sessions" value={formatInteger(sessions.data?.length)} detail="Browser sessions" tone="warning" />
          <MetricCard label="Test runs" value={formatInteger(testRuns.data?.length)} detail="Verification runs" tone="neutral" />
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
            title="Browser runtimes"
            description="Runtime capabilities exposed by the browser module."
            state={runtimes}
            tone="healthy"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Runtime</TableCell>
                    <TableCell>Deterministic</TableCell>
                    <TableCell>Agentic</TableCell>
                    <TableCell>Human takeover</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((runtime) => (
                    <TableRow key={runtime.id}>
                      <TableCell sx={{ fontWeight: 600 }}>{runtime.id}</TableCell>
                      <TableCell>{runtime.deterministic ? 'Yes' : 'No'}</TableCell>
                      <TableCell>{runtime.agentic ? 'Yes' : 'No'}</TableCell>
                      <TableCell>{runtime.humanTakeover ? 'Yes' : 'No'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Profiles"
            description="Registered browser profiles."
            state={profiles}
            tone="info"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Runtime</TableCell>
                    <TableCell>Browser</TableCell>
                    <TableCell>Headless</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell sx={{ fontWeight: 600 }}>{profile.name}</TableCell>
                      <TableCell>{profile.runtime}</TableCell>
                      <TableCell>{profile.browser}</TableCell>
                      <TableCell>{profile.headless ? 'Yes' : 'No'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Sessions"
            description="Live browser sessions and tab state."
            state={sessions}
            tone="warning"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Session</TableCell>
                    <TableCell>Profile</TableCell>
                    <TableCell>Runtime</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Tabs</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell sx={{ fontWeight: 600 }}>{session.id}</TableCell>
                      <TableCell>{session.profileId}</TableCell>
                      <TableCell>{session.runtime}</TableCell>
                      <TableCell>
                        <StatusBadge label={session.status} tone={toneForStatus(session.status)} />
                      </TableCell>
                      <TableCell>{session.tabs.length}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Evidence"
            description="Browser evidence records captured during execution."
            state={evidence}
            tone="healthy"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Session</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>URL</TableCell>
                    <TableCell>Runtime</TableCell>
                    <TableCell>Timestamp</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((entry) => (
                    <TableRow key={`${entry.sessionId}:${entry.timestamp}:${entry.action}`}>
                      <TableCell sx={{ fontWeight: 600 }}>{entry.sessionId}</TableCell>
                      <TableCell>{entry.action}</TableCell>
                      <TableCell>{entry.url}</TableCell>
                      <TableCell>{entry.runtime}</TableCell>
                      <TableCell>{formatDateTime(entry.timestamp)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Test runs"
            description="Verification runs and attached evidence identifiers."
            state={testRuns}
            tone="neutral"
            renderContent={(catalog) => (
              <Stack spacing={2}>
                <KeyValueList items={[{ label: 'Runs', value: formatInteger(catalog.length) }, { label: 'With evidence', value: formatInteger(catalog.filter((run) => run.evidenceId !== undefined).length) }]} />
                <Divider />
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Run</TableCell>
                      <TableCell>Target</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Total</TableCell>
                      <TableCell>Passed</TableCell>
                      <TableCell>Failed</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {catalog.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell sx={{ fontWeight: 600 }}>{run.id}</TableCell>
                        <TableCell>{run.target}</TableCell>
                        <TableCell>
                          <StatusBadge label={run.status} tone={toneForStatus(run.status)} />
                        </TableCell>
                        <TableCell>{run.summary.total}</TableCell>
                        <TableCell>{run.summary.passed}</TableCell>
                        <TableCell>{run.summary.failed}</TableCell>
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
