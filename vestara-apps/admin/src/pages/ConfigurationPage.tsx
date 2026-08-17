import { Box, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { PageContainer, StatusBadge } from '@vestara/ui';

import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { useAdminApiClient } from '../app/hooks/useAdminApiClient.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { formatDateTime, formatInteger } from '../app/utils/format.js';
import { toneForStatus } from '../app/utils/status.js';

export function ConfigurationPage() {
  const client = useAdminApiClient();

  const contributions = useAsyncState((signal) => client.listConfigContributions(signal), [client]);
  const fields = useAsyncState((signal) => client.listConfigFields(signal), [client]);
  const transactions = useAsyncState((signal) => client.listConfigTransactions(signal), [client]);

  return (
    <PageContainer title="Configuration" description="Field inventory, package contributions, and transactional provenance.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Manage' }, { label: 'Configuration' }]} />

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
          <MetricCard label="Contributions" value={formatInteger(contributions.data?.length)} detail="Configuration packages" tone="healthy" />
          <MetricCard label="Fields" value={formatInteger(fields.data?.length)} detail="Resolved field inventory" tone="info" />
          <MetricCard label="Secret fields" value={formatInteger(fields.data?.filter((field) => field.secret === true).length)} detail="Protected values" tone="warning" />
          <MetricCard label="Transactions" value={formatInteger(transactions.data?.length)} detail="Atomic config transactions" tone="neutral" />
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
            title="Field inventory"
            description="Resolved fields, reload behavior, and risk level."
            state={fields}
            tone="info"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Key</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Risk</TableCell>
                    <TableCell>Reload</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((field) => (
                    <TableRow key={field.key}>
                      <TableCell sx={{ fontWeight: 600 }}>{field.key}</TableCell>
                      <TableCell>{field.title}</TableCell>
                      <TableCell>{field.type}</TableCell>
                      <TableCell>
                        <StatusBadge label={field.risk} tone={toneForStatus(field.risk)} />
                      </TableCell>
                      <TableCell>{field.reloadBehavior}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Contributions"
            description="Packages contributing configuration fields."
            state={contributions}
            tone="healthy"
            renderContent={(catalog) => (
              <Stack spacing={2}>
                <KeyValueList items={[{ label: 'Packages', value: formatInteger(catalog.length) }, { label: 'Fields', value: formatInteger(catalog.reduce((total, contribution) => total + contribution.fields.length, 0)) }]} />
                <Divider />
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Package</TableCell>
                      <TableCell>Namespace</TableCell>
                      <TableCell>Version</TableCell>
                      <TableCell>Fields</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {catalog.map((contribution) => (
                      <TableRow key={contribution.packageId}>
                        <TableCell sx={{ fontWeight: 600 }}>{contribution.packageId}</TableCell>
                        <TableCell>{contribution.namespace}</TableCell>
                        <TableCell>{contribution.version}</TableCell>
                        <TableCell>{contribution.fields.length}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Stack>
            )}
          />

          <LoadableCard
            title="Transactions"
            description="Revisioned configuration transactions and status."
            state={transactions}
            tone="warning"
            renderContent={(catalog) => (
              <Stack spacing={2}>
                <KeyValueList items={[{ label: 'Transactions', value: formatInteger(catalog.length) }]} />
                <Divider />
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Id</TableCell>
                      <TableCell>Scope</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Created</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {catalog.slice(0, 20).map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell sx={{ fontWeight: 600 }}>{transaction.id}</TableCell>
                        <TableCell>{transaction.scope.type}</TableCell>
                        <TableCell>
                          <StatusBadge label={transaction.status} tone={toneForStatus(transaction.status)} />
                        </TableCell>
                        <TableCell>{formatDateTime(transaction.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Stack>
            )}
          />

          <LoadableCard
            title="Field highlights"
            description="Security and secret handling emphasis."
            state={fields}
            tone="warning"
            renderContent={(catalog) => (
              <Stack spacing={2}>
                <KeyValueList
                  items={[
                    { label: 'Secret fields', value: formatInteger(catalog.filter((field) => field.secret === true).length) },
                    { label: 'Required fields', value: formatInteger(catalog.filter((field) => field.required === true).length) },
                    { label: 'High-risk fields', value: formatInteger(catalog.filter((field) => field.risk !== 'low').length) },
                  ]}
                />
                <Divider />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {catalog.slice(0, 12).map((field) => (
                    <StatusBadge key={field.key} label={`${field.key} · ${field.risk}`} tone={toneForStatus(field.risk)} />
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
