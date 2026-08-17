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

export function DatabasePage() {
  const client = useAdminApiClient();

  const definitions = useAsyncState((signal) => client.listDatabaseDefinitions(signal), [client]);
  const connections = useAsyncState((signal) => client.listDatabaseConnections(signal), [client]);

  const totalTables = definitions.data?.reduce((count, definition) => count + definition.tables.length, 0);
  const engines = new Set(definitions.data?.map((definition) => definition.engine) ?? []);

  return (
    <PageContainer title="Database" description="Database definitions, migration planning, and connections.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Data' }, { label: 'Database' }]} />

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
          <MetricCard label="Definitions" value={formatInteger(definitions.data?.length)} detail="Registered database definitions" tone="healthy" />
          <MetricCard label="Tables" value={formatInteger(totalTables)} detail="Tables across definitions" tone="info" />
          <MetricCard label="Engines" value={formatInteger(engines.size)} detail="Distinct database engines" tone="warning" />
          <MetricCard label="Connections" value={formatInteger(connections.data?.length)} detail="Known database connections" tone="neutral" />
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
            title="Definitions"
            description="Definition registry and table layout."
            state={definitions}
            tone="healthy"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Engine</TableCell>
                    <TableCell>Tables</TableCell>
                    <TableCell>Revision</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((definition) => (
                    <TableRow key={definition.id}>
                      <TableCell sx={{ fontWeight: 600 }}>
                        <Stack spacing={0.25}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {definition.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {definition.id}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{definition.engine}</TableCell>
                      <TableCell>{compactList(definition.tables.map((table) => table.name).slice(0, 4))}</TableCell>
                      <TableCell>{definition.revision}</TableCell>
                      <TableCell>
                        <StatusBadge label={definition.status} tone={toneForStatus(definition.status)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Connections"
            description="Configured databases and credential references."
            state={connections}
            tone="warning"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Engine</TableCell>
                    <TableCell>Host</TableCell>
                    <TableCell>Database</TableCell>
                    <TableCell>Credential ref</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((connection) => (
                    <TableRow key={connection.id}>
                      <TableCell sx={{ fontWeight: 600 }}>{connection.name}</TableCell>
                      <TableCell>{connection.engine}</TableCell>
                      <TableCell>{connection.host}</TableCell>
                      <TableCell>{connection.database}</TableCell>
                      <TableCell>{connection.credentialRef}</TableCell>
                      <TableCell>
                        <StatusBadge label={connection.status} tone={toneForStatus(connection.status)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Schema footprint"
            description="Table layout depth across database definitions."
            state={definitions}
            tone="info"
            renderContent={(catalog) => (
              <Stack spacing={2}>
                <KeyValueList
                  items={[
                    { label: 'Definitions', value: formatInteger(catalog.length) },
                    { label: 'Total tables', value: formatInteger(catalog.reduce((count, definition) => count + definition.tables.length, 0)) },
                    { label: 'Engines', value: formatInteger(new Set(catalog.map((definition) => definition.engine)).size) },
                  ]}
                />
                <Divider />
                <Typography variant="body2" color="text.secondary">
                  Database migration planning stays governed by backend validation; this page is intentionally read-first.
                </Typography>
              </Stack>
            )}
          />

          <LoadableCard
            title="Engine coverage"
            description="Distinct database engines currently represented in the registry."
            state={definitions}
            tone="neutral"
            renderContent={(catalog) => (
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {Array.from(new Set(catalog.map((definition) => definition.engine))).map((engine) => (
                  <StatusBadge key={engine} label={engine} tone="neutral" />
                ))}
              </Stack>
            )}
          />
        </Box>
      </Stack>
    </PageContainer>
  );
}
