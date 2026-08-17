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

export function SecurityPage() {
  const client = useAdminApiClient();

  const permissions = useAsyncState((signal) => client.listPermissions(signal), [client]);
  const roles = useAsyncState((signal) => client.listPermissionRoles(signal), [client]);
  const grants = useAsyncState((signal) => client.listTemporaryGrants(signal), [client]);

  return (
    <PageContainer title="Security" description="Authorization risk posture, temporary grants, and role footprint.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'System' }, { label: 'Security' }]} />

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
          <MetricCard label="Permissions" value={formatInteger(permissions.data?.length)} detail="Authorization definitions" tone="healthy" />
          <MetricCard label="Critical" value={formatInteger(permissions.data?.filter((permission) => permission.risk === 'critical').length)} detail="Critical permissions" tone="critical" />
          <MetricCard label="Roles" value={formatInteger(roles.data?.length)} detail="Role assignments" tone="info" />
          <MetricCard label="Temporary grants" value={formatInteger(grants.data?.length)} detail="Expiring grants" tone="warning" />
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
            title="Risk summary"
            description="Risk classification across permission definitions."
            state={permissions}
            tone="warning"
            renderContent={(catalog) => (
              <Stack spacing={2}>
                <KeyValueList
                  items={[
                    { label: 'Low', value: formatInteger(catalog.filter((permission) => permission.risk === 'low').length) },
                    { label: 'Medium', value: formatInteger(catalog.filter((permission) => permission.risk === 'medium').length) },
                    { label: 'High', value: formatInteger(catalog.filter((permission) => permission.risk === 'high').length) },
                    { label: 'Critical', value: formatInteger(catalog.filter((permission) => permission.risk === 'critical').length) },
                  ]}
                />
                <Divider />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {catalog.slice(0, 16).map((permission) => (
                    <StatusBadge key={permission.id} label={`${permission.resource}:${permission.action}`} tone={toneForStatus(permission.risk)} />
                  ))}
                </Stack>
              </Stack>
            )}
          />

          <LoadableCard
            title="Roles"
            description="Role-based permission sets."
            state={roles}
            tone="info"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Permissions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell sx={{ fontWeight: 600 }}>{role.name}</TableCell>
                      <TableCell>{role.permissions.length}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Temporary grants"
            description="Lease-based exceptions and their usage."
            state={grants}
            tone="warning"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Principal</TableCell>
                    <TableCell>Permission</TableCell>
                    <TableCell>Uses</TableCell>
                    <TableCell>Expires</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((grant) => (
                    <TableRow key={grant.id}>
                      <TableCell sx={{ fontWeight: 600 }}>{grant.principalId}</TableCell>
                      <TableCell>{grant.permission}</TableCell>
                      <TableCell>{grant.uses}</TableCell>
                      <TableCell>{formatDateTime(grant.expiresAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Policy surface"
            description="Composite posture indicators across the authorization layer."
            state={permissions}
            tone="neutral"
            renderContent={(catalog) => (
              <Stack spacing={2}>
                <KeyValueList
                  items={[
                    { label: 'Definitions', value: formatInteger(catalog.length) },
                    { label: 'Descriptions', value: formatInteger(catalog.filter((permission) => permission.description !== undefined).length) },
                    { label: 'High-risk', value: formatInteger(catalog.filter((permission) => permission.risk === 'high' || permission.risk === 'critical').length) },
                  ]}
                />
                <Divider />
                <Typography variant="body2" color="text.secondary">
                  This page summarizes the authorization posture. Detailed grant and evaluation flows remain in the dedicated permissions page.
                </Typography>
              </Stack>
            )}
          />
        </Box>
      </Stack>
    </PageContainer>
  );
}

