import { Box, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { PageContainer, StatusBadge } from '@vestara/ui';

import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { useAdminApiClient } from '../app/hooks/useAdminApiClient.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { compactList, formatInteger } from '../app/utils/format.js';
import { toneForStatus } from '../app/utils/status.js';

export function GeneratorPage() {
  const client = useAdminApiClient();

  const generators = useAsyncState((signal) => client.listGenerators(signal), [client]);
  const capabilities = useAsyncState((signal) => client.listGeneratorCapabilities(signal), [client]);

  const secretGenerators = generators.data?.filter((generator) => generator.requiresSecrets).length;

  return (
    <PageContainer title="Generator" description="Registered generators and shared generation capabilities.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Build' }, { label: 'Generator' }]} />

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
          <MetricCard label="Generators" value={formatInteger(generators.data?.length)} detail="Registered generation services" tone="healthy" />
          <MetricCard label="Capabilities" value={formatInteger(capabilities.data?.length)} detail="Supported generator capabilities" tone="info" />
          <MetricCard label="Secret-backed" value={formatInteger(secretGenerators)} detail="Generators needing secrets" tone="warning" />
          <MetricCard label="Open" value={formatInteger(generators.data?.filter((generator) => !generator.requiresSecrets).length)} detail="Generators without secrets" tone="neutral" />
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
            title="Generators"
            description="Registered generator descriptors."
            state={generators}
            tone="healthy"
            renderContent={(catalog) => (
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
                  {catalog.map((generator) => (
                    <TableRow key={generator.id}>
                      <TableCell sx={{ fontWeight: 600 }}>{generator.id}</TableCell>
                      <TableCell>{generator.version}</TableCell>
                      <TableCell>{compactList(generator.capabilities)}</TableCell>
                      <TableCell>
                        <StatusBadge label={generator.requiresSecrets ? 'Required' : 'Optional'} tone={generator.requiresSecrets ? 'warning' : 'healthy'} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Capability list"
            description="Registry-wide capability list exposed by the generator plane."
            state={capabilities}
            tone="info"
            renderContent={(catalog) => (
              <Stack spacing={2}>
                <KeyValueList items={[{ label: 'Capabilities', value: formatInteger(catalog.length) }]} />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {catalog.map((capability) => (
                    <StatusBadge key={capability} label={capability} tone="neutral" />
                  ))}
                </Stack>
              </Stack>
            )}
          />

          <LoadableCard
            title="Capability density"
            description="How wide the registered generator surface is."
            state={generators}
            tone="warning"
            renderContent={(catalog) => (
              <Stack spacing={1.5}>
                {catalog.slice(0, 4).map((generator) => (
                  <Stack key={generator.id} spacing={0.75}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {generator.id}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {compactList(generator.capabilities)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          />

          <LoadableCard
            title="Risk"
            description="Generators that require secrets are isolated and clearly marked."
            state={generators}
            tone="neutral"
            renderContent={(catalog) => (
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {catalog.map((generator) => (
                  <StatusBadge
                    key={generator.id}
                    label={`${generator.id}:${generator.requiresSecrets ? 'secret' : 'open'}`}
                    tone={toneForStatus(generator.requiresSecrets ? 'warning' : 'healthy')}
                  />
                ))}
              </Stack>
            )}
          />
        </Box>
      </Stack>
    </PageContainer>
  );
}
