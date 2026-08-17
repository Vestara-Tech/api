import { Box, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { PageContainer, StatusBadge } from '@vestara/ui';

import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { useAdminApiClient } from '../app/hooks/useAdminApiClient.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { compactList, formatDateTime, formatInteger } from '../app/utils/format.js';
import { toneForStatus } from '../app/utils/status.js';

export function MarketplacePage() {
  const client = useAdminApiClient();

  const contributions = useAsyncState((signal) => client.listMarketplaceContributions(signal), [client]);
  const bundles = useAsyncState((signal) => client.listMarketplaceBundles(signal), [client]);
  const distributions = useAsyncState((signal) => client.listMarketplaceDistributions(signal), [client]);
  const published = useAsyncState((signal) => client.listMarketplacePublished(signal), [client]);

  return (
    <PageContainer title="Marketplace" description="Distribution, bundle, and publication inventory.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Manage' }, { label: 'Marketplace' }]} />

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
          <MetricCard label="Contributions" value={formatInteger(contributions.data?.length)} detail="Registered v2 manifests" tone="healthy" />
          <MetricCard label="Bundles" value={formatInteger(bundles.data?.length)} detail="Composable package bundles" tone="info" />
          <MetricCard label="Distributions" value={formatInteger(distributions.data?.length)} detail="Curated channel distributions" tone="warning" />
          <MetricCard label="Published" value={formatInteger(published.data?.length)} detail="Published package records" tone="neutral" />
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
            title="Contributions"
            description="Package manifests and the module contributions they register."
            state={contributions}
            tone="healthy"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Package</TableCell>
                    <TableCell>Version</TableCell>
                    <TableCell>Provides</TableCell>
                    <TableCell>Requires</TableCell>
                    <TableCell>Optional</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((contribution) => (
                    <TableRow key={contribution.packageId}>
                      <TableCell sx={{ fontWeight: 600 }}>{contribution.packageId}</TableCell>
                      <TableCell>{contribution.version}</TableCell>
                      <TableCell>{compactList(contribution.manifest.provides.map((provide) => provide.kind))}</TableCell>
                      <TableCell>{compactList(contribution.manifest.requires.map((entry) => entry.module))}</TableCell>
                      <TableCell>{compactList(contribution.manifest.optional.map((entry) => entry.module))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Bundles"
            description="Installable package bundles and their composition."
            state={bundles}
            tone="info"
            renderContent={(catalog) => (
              <Stack spacing={2}>
                <KeyValueList items={[{ label: 'Bundles', value: formatInteger(catalog.length) }, { label: 'AI bundles', value: formatInteger(catalog.filter((bundle) => bundle.ai !== undefined && bundle.ai.length > 0).length) }]} />
                <Divider />
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Packages</TableCell>
                      <TableCell>Recommended</TableCell>
                      <TableCell>Optional</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {catalog.map((bundle) => (
                      <TableRow key={bundle.bundleId}>
                        <TableCell sx={{ fontWeight: 600 }}>
                          <Stack spacing={0.25}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {bundle.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {bundle.bundleId}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>{bundle.packages.length}</TableCell>
                        <TableCell>{bundle.recommended.length}</TableCell>
                        <TableCell>{bundle.optional.length}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Stack>
            )}
          />

          <LoadableCard
            title="Distributions"
            description="Curated distributions and channel metadata."
            state={distributions}
            tone="warning"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Channel</TableCell>
                    <TableCell>Curated by</TableCell>
                    <TableCell>Bundles</TableCell>
                    <TableCell>Packages</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((distribution) => (
                    <TableRow key={distribution.distributionId}>
                      <TableCell sx={{ fontWeight: 600 }}>
                        <Stack spacing={0.25}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {distribution.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {distribution.distributionId}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{distribution.channel}</TableCell>
                      <TableCell>{distribution.curatedBy}</TableCell>
                      <TableCell>{distribution.bundles.length}</TableCell>
                      <TableCell>{distribution.packages.length}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Published packages"
            description="Signed package publications and their channels."
            state={published}
            tone="healthy"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Package</TableCell>
                    <TableCell>Version</TableCell>
                    <TableCell>Trust</TableCell>
                    <TableCell>Channel</TableCell>
                    <TableCell>Published</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((item) => (
                    <TableRow key={`${item.packageId}:${item.version}:${item.channel}`}>
                      <TableCell sx={{ fontWeight: 600 }}>{item.packageId}</TableCell>
                      <TableCell>{item.version}</TableCell>
                      <TableCell>
                        <StatusBadge label={item.trustLevel} tone={toneForStatus(item.trustLevel)} />
                      </TableCell>
                      <TableCell>{item.channel}</TableCell>
                      <TableCell>{formatDateTime(item.publishedAt)}</TableCell>
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

