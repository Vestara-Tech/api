import { Box, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { PageContainer, StatusBadge, type StatusTone } from '@vestara/ui';

import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { useWorkspaceApiClient } from '../app/hooks/useWorkspaceApiClient.js';
import { compactList, formatDateTime, formatInteger } from '../app/utils/format.js';
import { summarizePages } from '../app/utils/summaries.js';

function authTone(authRequired: boolean): StatusTone {
  return authRequired ? 'warning' : 'healthy';
}

export function PagesPage() {
  const client = useWorkspaceApiClient();
  const pages = useAsyncState((signal) => client.listPages(signal), [client]);
  const summary = summarizePages(pages.data ?? []);

  return (
    <PageContainer title="Pages" description="Declarative page definitions, layouts, and wiring contracts.">
      <Stack spacing={2.5}>
        <PageBreadcrumbs
          items={[
            { label: 'Workspace', href: '/workspace/overview' },
            { label: 'Compose' },
            { label: 'Pages' },
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
          <MetricCard label="Pages" value={formatInteger(summary.totalPages)} detail="Declared page definitions" />
          <MetricCard label="Auth required" value={formatInteger(summary.authRequiredPages)} detail="Pages guarded by auth" />
          <MetricCard label="Nodes" value={formatInteger(summary.totalNodes)} detail="Rendered node inventory" />
          <MetricCard label="Data sources" value={formatInteger(summary.totalDataSources)} detail="Bound data source inventory" />
        </Box>

        <MetricCard label="Actions" value={formatInteger(summary.totalActions)} detail="Declared page-level actions" />

        <LoadableCard
          title="Page registry"
          description="Route, layout, and access control inventory."
          state={pages}
          renderContent={(data) => (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Route</TableCell>
                    <TableCell>Layout</TableCell>
                    <TableCell>Revision</TableCell>
                    <TableCell>Auth</TableCell>
                    <TableCell align="right">Nodes</TableCell>
                    <TableCell align="right">Data sources</TableCell>
                    <TableCell>Updated</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.length > 0 ? (
                    data.map((page) => (
                      <TableRow key={page.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {page.metadata.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {page.id}
                          </Typography>
                        </TableCell>
                        <TableCell>{page.route}</TableCell>
                        <TableCell>{page.layout.type}</TableCell>
                        <TableCell>{page.revision}</TableCell>
                        <TableCell>
                          <StatusBadge label={page.metadata.authRequired ? 'Required' : 'Open'} tone={authTone(page.metadata.authRequired)} />
                        </TableCell>
                        <TableCell align="right">{formatInteger(page.nodes.length)}</TableCell>
                        <TableCell align="right">{formatInteger(page.dataSources.length)}</TableCell>
                        <TableCell>{formatDateTime(page.updatedAt)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <Typography variant="body2" color="text.secondary">
                          No pages have been registered yet.
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
          title="Selected page"
          description="Operational details for the first page definition."
          state={pages}
          renderContent={(data) => {
            const page = data[0];

            if (page === undefined) {
              return (
                <Typography variant="body2" color="text.secondary">
                  No page details available.
                </Typography>
              );
            }

            return (
              <Stack spacing={1.5}>
                <KeyValueList
                  items={[
                    { label: 'Title', value: page.metadata.title },
                    { label: 'Identifier', value: page.id },
                    { label: 'Route', value: page.route },
                    { label: 'Layout type', value: page.layout.type },
                    { label: 'Revision', value: formatInteger(page.revision) },
                    { label: 'Auth required', value: <StatusBadge label={page.metadata.authRequired ? 'Required' : 'Open'} tone={authTone(page.metadata.authRequired)} /> },
                    { label: 'Nodes', value: formatInteger(page.nodes.length) },
                    { label: 'Data sources', value: formatInteger(page.dataSources.length) },
                    { label: 'Actions', value: formatInteger(page.actions.length) },
                    { label: 'Permissions', value: formatInteger(page.permissions.length) },
                    { label: 'Responsive rules', value: formatInteger(page.responsive.length) },
                    { label: 'Updated', value: formatDateTime(page.updatedAt) },
                  ]}
                />

                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    Structural summary
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Nodes: {formatInteger(page.nodes.length)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Data sources: {formatInteger(page.dataSources.length)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Actions: {compactList(page.actions.map((action) => formatAction(action)))}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Permissions: {compactList(page.permissions.map((permission) => formatAction(permission)))}
                  </Typography>
                </Box>
              </Stack>
            );
          }}
        />
      </Stack>
    </PageContainer>
  );
}

function formatAction(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  if (value === null) return 'null';
  if (value === undefined) return '—';
  try {
    return JSON.stringify(value);
  } catch {
    return '[Object]';
  }
}
