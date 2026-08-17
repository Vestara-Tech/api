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

export function ComponentsPage() {
  const client = useAdminApiClient();

  const components = useAsyncState((signal) => client.listComponents(signal), [client]);
  const categories = useAsyncState((signal) => client.listComponentCategories(signal), [client]);
  const trees = useAsyncState((signal) => client.listComponentTrees(signal), [client]);

  return (
    <PageContainer title="Components" description="Component registry, categories, and trees.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Build' }, { label: 'Components' }]} />

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
          <MetricCard label="Components" value={formatInteger(components.data?.length)} detail="Registered components" tone="healthy" />
          <MetricCard label="Categories" value={formatInteger(categories.data?.length)} detail="Component categories" tone="info" />
          <MetricCard label="Trees" value={formatInteger(trees.data?.length)} detail="Component trees" tone="warning" />
          <MetricCard label="Slots" value={formatInteger(components.data?.reduce((count, component) => count + component.slots.length, 0))} detail="Declared slots" tone="neutral" />
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
            title="Components"
            description="Registry-backed component inventory."
            state={components}
            tone="healthy"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Display</TableCell>
                    <TableCell>Version</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((component) => (
                    <TableRow key={component.id}>
                      <TableCell sx={{ fontWeight: 600 }}>{component.name}</TableCell>
                      <TableCell>{component.displayName}</TableCell>
                      <TableCell>{component.version}</TableCell>
                      <TableCell>{component.category}</TableCell>
                      <TableCell>
                        <StatusBadge label={component.status} tone={toneForStatus(component.status)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Categories"
            description="Counts by component category."
            state={categories}
            tone="info"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Category</TableCell>
                    <TableCell>Count</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((category) => (
                    <TableRow key={category.name}>
                      <TableCell sx={{ fontWeight: 600 }}>{category.name}</TableCell>
                      <TableCell>{category.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Trees"
            description="Component trees available for preview and validation."
            state={trees}
            tone="warning"
            renderContent={(catalog) => (
              <Stack spacing={1.5}>
                {catalog.map((tree) => (
                  <Stack key={tree.id} spacing={0.25}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {tree.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {tree.id}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          />

          <LoadableCard
            title="Capability footprint"
            description="Declared component capabilities and slot density."
            state={components}
            tone="neutral"
            renderContent={(catalog) => (
              <Stack spacing={1.5}>
                <KeyValueList
                  items={[
                    { label: 'Components', value: formatInteger(catalog.length) },
                    { label: 'Capabilities', value: formatInteger(new Set(catalog.flatMap((component) => component.capabilities)).size) },
                  ]}
                />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {Array.from(new Set(catalog.flatMap((component) => component.capabilities))).slice(0, 16).map((capability) => (
                    <StatusBadge key={capability} label={capability} tone="neutral" />
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
