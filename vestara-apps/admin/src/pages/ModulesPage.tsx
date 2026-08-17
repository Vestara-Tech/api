import { Box, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { PageContainer, StatusBadge } from '@vestara/ui';

import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { useAdminApiClient } from '../app/hooks/useAdminApiClient.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { compactList, formatInteger } from '../app/utils/format.js';
import { toneForStatus } from '../app/utils/status.js';

export function ModulesPage() {
  const client = useAdminApiClient();

  const contributions = useAsyncState((signal) => client.listMarketplaceContributions(signal), [client]);
  const bundles = useAsyncState((signal) => client.listMarketplaceBundles(signal), [client]);
  const published = useAsyncState((signal) => client.listMarketplacePublished(signal), [client]);

  const providedKinds = new Set<string>();
  const requiredModules = new Set<string>();
  const optionalModules = new Set<string>();

  for (const contribution of contributions.data ?? []) {
    for (const item of contribution.manifest.provides) providedKinds.add(item.kind);
    for (const item of contribution.manifest.requires) requiredModules.add(item.module);
    for (const item of contribution.manifest.optional) optionalModules.add(item.module);
  }

  return (
    <PageContainer title="Modules" description="Installed module contributions and their dependency footprint.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Manage' }, { label: 'Modules' }]} />

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
          <MetricCard label="Contributions" value={formatInteger(contributions.data?.length)} detail="Registered manifests" tone="healthy" />
          <MetricCard label="Provides" value={formatInteger(providedKinds.size)} detail="Unique provided kinds" tone="info" />
          <MetricCard label="Requires" value={formatInteger(requiredModules.size)} detail="Required modules" tone="warning" />
          <MetricCard label="Optional" value={formatInteger(optionalModules.size)} detail="Optional modules" tone="neutral" />
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
            title="Contribution registry"
            description="Module contribution manifests with resolution footprint."
            state={contributions}
            tone="healthy"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Package</TableCell>
                    <TableCell>Provides</TableCell>
                    <TableCell>Requires</TableCell>
                    <TableCell>Optional</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((contribution) => (
                    <TableRow key={contribution.packageId}>
                      <TableCell sx={{ fontWeight: 600 }}>
                        <Stack spacing={0.25}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {contribution.packageId}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {contribution.version}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{compactList(contribution.manifest.provides.map((item) => item.kind))}</TableCell>
                      <TableCell>{compactList(contribution.manifest.requires.map((item) => item.module))}</TableCell>
                      <TableCell>{compactList(contribution.manifest.optional.map((item) => item.module))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Bundle coverage"
            description="Bundles that aggregate module contributions."
            state={bundles}
            tone="info"
            renderContent={(catalog) => (
              <Stack spacing={2}>
                <KeyValueList items={[{ label: 'Bundles', value: formatInteger(catalog.length) }, { label: 'AI bundles', value: formatInteger(catalog.filter((bundle) => bundle.ai !== undefined && bundle.ai.length > 0).length) }]} />
                <Divider />
                <Stack spacing={1}>
                  {catalog.map((bundle) => (
                    <Stack key={bundle.bundleId} direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {bundle.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {bundle.bundleId}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <StatusBadge label={`${bundle.packages.length} packages`} tone="healthy" />
                        <StatusBadge label={`${bundle.recommended.length} recommended`} tone="info" />
                        <StatusBadge label={`${bundle.optional.length} optional`} tone="neutral" />
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            )}
          />

          <LoadableCard
            title="Provided kinds"
            description="Unique contribution kinds currently present in the registry."
            state={contributions}
            tone="warning"
            renderContent={() => (
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {[...providedKinds].map((kind) => (
                    <StatusBadge key={kind} label={kind} tone="healthy" />
                  ))}
                </Stack>
              </Stack>
            )}
          />

          <LoadableCard
            title="Publish status"
            description="Currently published module packages."
            state={published}
            tone="healthy"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Package</TableCell>
                    <TableCell>Version</TableCell>
                    <TableCell>Channel</TableCell>
                    <TableCell>Trust</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((item) => (
                    <TableRow key={`${item.packageId}:${item.version}:${item.channel}`}>
                      <TableCell sx={{ fontWeight: 600 }}>{item.packageId}</TableCell>
                      <TableCell>{item.version}</TableCell>
                      <TableCell>{item.channel}</TableCell>
                      <TableCell>
                        <StatusBadge label={item.trustLevel} tone={toneForStatus(item.trustLevel)} />
                      </TableCell>
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
