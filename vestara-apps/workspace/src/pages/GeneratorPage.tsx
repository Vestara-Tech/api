import { Box, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { PageContainer, StatusBadge } from '@vestara/ui';

import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { useWorkspaceApiClient } from '../app/hooks/useWorkspaceApiClient.js';
import { compactList, formatInteger } from '../app/utils/format.js';
import { summarizeGenerators } from '../app/utils/summaries.js';

export function GeneratorPage() {
  const client = useWorkspaceApiClient();
  const generators = useAsyncState((signal) => client.listGenerators(signal), [client]);
  const capabilities = useAsyncState((signal) => client.listGeneratorCapabilities(signal), [client]);
  const summary = summarizeGenerators(generators.data ?? []);

  return (
    <PageContainer title="Generator" description="Registered generator engines and shared generation capability surface.">
      <Stack spacing={2.5}>
        <PageBreadcrumbs
          items={[
            { label: 'Workspace', href: '/workspace/overview' },
            { label: 'Build' },
            { label: 'Generator' },
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
          <MetricCard label="Generators" value={formatInteger(summary.totalGenerators)} detail="Registered generation engines" />
          <MetricCard label="Capabilities" value={formatInteger(summary.uniqueCapabilities)} detail="Unique generator capabilities" />
          <MetricCard label="Secrets" value={formatInteger(summary.secretGenerators)} detail="Generators that require secrets" />
          <MetricCard label="Versions" value={formatInteger(summary.distinctVersions)} detail="Distinct generator versions" />
        </Box>

        <LoadableCard
          title="Generator registry"
          description="Descriptor inventory and capability support."
          state={generators}
          renderContent={(data) => (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Generator</TableCell>
                    <TableCell>Version</TableCell>
                    <TableCell>Capabilities</TableCell>
                    <TableCell>Secrets</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.length > 0 ? (
                    data.map((generator) => (
                      <TableRow key={generator.id} hover>
                        <TableCell sx={{ fontWeight: 700 }}>{generator.id}</TableCell>
                        <TableCell>{generator.version}</TableCell>
                        <TableCell>{compactList(generator.capabilities)}</TableCell>
                        <TableCell>
                          <StatusBadge label={generator.requiresSecrets ? 'Required' : 'Not required'} tone={generator.requiresSecrets ? 'warning' : 'healthy'} />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Typography variant="body2" color="text.secondary">
                          No generators have been registered yet.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          )}
        />

        <LoadableCard
          title="Generator capabilities"
          description="Platform-level generator operations exposed through the API."
          state={capabilities}
          renderContent={(data) => (
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              {data.length > 0 ? (
                data.map((capability) => <StatusBadge key={capability} label={capability} tone="neutral" />)
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No generator capabilities were returned.
                </Typography>
              )}
            </Stack>
          )}
        />

        <LoadableCard
          title="Selected generator"
          description="Descriptor details for the first registered generator."
          state={generators}
          renderContent={(data) => {
            const generator = data[0];

            if (generator === undefined) {
              return (
                <Typography variant="body2" color="text.secondary">
                  No generator details available.
                </Typography>
              );
            }

            return (
              <Stack spacing={1.5}>
                <KeyValueList
                  items={[
                    { label: 'Identifier', value: generator.id },
                    { label: 'Version', value: generator.version },
                    { label: 'Capabilities', value: compactList(generator.capabilities) },
                    { label: 'Secrets required', value: <StatusBadge label={generator.requiresSecrets ? 'Yes' : 'No'} tone={generator.requiresSecrets ? 'warning' : 'healthy'} /> },
                  ]}
                />
              </Stack>
            );
          }}
        />
      </Stack>
    </PageContainer>
  );
}
