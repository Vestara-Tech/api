import { Box, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { PageContainer, StatusBadge } from '@vestara/ui';

import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { useAdminApiClient } from '../app/hooks/useAdminApiClient.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { formatDateTime, formatInteger } from '../app/utils/format.js';
import { toneForStatus } from '../app/utils/status.js';

export function PagesPage() {
  const client = useAdminApiClient();

  const pages = useAsyncState((signal) => client.listPages(signal), [client]);

  const authRequiredCount = pages.data?.filter((page) => page.metadata.authRequired).length;
  const routeCount = new Set(pages.data?.map((page) => page.route) ?? []).size;
  const totalNodes = pages.data?.reduce((count, page) => count + page.nodes.length, 0);

  return (
    <PageContainer title="Pages" description="Declarative page definitions and their layout surface.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Build' }, { label: 'Pages' }]} />

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
          <MetricCard label="Pages" value={formatInteger(pages.data?.length)} detail="Declarative page definitions" tone="healthy" />
          <MetricCard label="Routes" value={formatInteger(routeCount)} detail="Unique page routes" tone="info" />
          <MetricCard label="Auth required" value={formatInteger(authRequiredCount)} detail="Protected pages" tone="warning" />
          <MetricCard label="Nodes" value={formatInteger(totalNodes)} detail="Total page nodes" tone="neutral" />
        </Box>

        <LoadableCard
          title="Page definitions"
          description="Current page registry state."
          state={pages}
          tone="healthy"
          renderContent={(catalog) => (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Page</TableCell>
                  <TableCell>Route</TableCell>
                  <TableCell>Layout</TableCell>
                  <TableCell>Nodes</TableCell>
                  <TableCell>Data sources</TableCell>
                  <TableCell>Auth</TableCell>
                  <TableCell>Revision</TableCell>
                  <TableCell>Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {catalog.map((page) => (
                  <TableRow key={page.id}>
                    <TableCell sx={{ fontWeight: 600 }}>
                      <Stack spacing={0.25}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {page.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {page.id}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{page.route}</TableCell>
                    <TableCell>{page.layout.type}</TableCell>
                    <TableCell>{page.nodes.length}</TableCell>
                    <TableCell>{page.dataSources.length}</TableCell>
                    <TableCell>
                      <StatusBadge label={page.metadata.authRequired ? 'Required' : 'Public'} tone={page.metadata.authRequired ? 'warning' : 'healthy'} />
                    </TableCell>
                    <TableCell>{page.revision}</TableCell>
                    <TableCell>{formatDateTime(page.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
            title="Layout types"
            description="Declared page layout primitives."
            state={pages}
            tone="info"
            renderContent={(catalog) => (
              <Stack spacing={1.5}>
                <KeyValueList
                  items={[
                    { label: 'Layouts', value: formatInteger(new Set(catalog.map((page) => page.layout.type)).size) },
                    { label: 'Routes', value: formatInteger(new Set(catalog.map((page) => page.route)).size) },
                  ]}
                />
                <Divider />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {Array.from(new Set(catalog.map((page) => page.layout.type))).map((type) => (
                    <StatusBadge key={type} label={type} tone="neutral" />
                  ))}
                </Stack>
              </Stack>
            )}
          />

          <LoadableCard
            title="Page coverage"
            description="Routing and auth coverage across the page registry."
            state={pages}
            tone="warning"
            renderContent={(catalog) => (
              <Stack spacing={1.5}>
                <KeyValueList
                  items={[
                    { label: 'Protected', value: formatInteger(catalog.filter((page) => page.metadata.authRequired).length) },
                    { label: 'Open', value: formatInteger(catalog.filter((page) => !page.metadata.authRequired).length) },
                    { label: 'Node count', value: formatInteger(catalog.reduce((count, page) => count + page.nodes.length, 0)) },
                  ]}
                />
                <Divider />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {catalog.slice(0, 10).map((page) => (
                    <StatusBadge key={page.id} label={page.route} tone={toneForStatus(page.metadata.authRequired ? 'warning' : 'healthy')} />
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
