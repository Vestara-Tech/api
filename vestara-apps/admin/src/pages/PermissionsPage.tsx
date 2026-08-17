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

export function PermissionsPage() {
  const client = useAdminApiClient();

  const permissions = useAsyncState((signal) => client.listPermissions(signal), [client]);
  const roles = useAsyncState((signal) => client.listPermissionRoles(signal), [client]);
  const grants = useAsyncState((signal) => client.listTemporaryGrants(signal), [client]);

  return (
    <PageContainer title="Permissions" description="Authorization definitions, role mappings, and temporary grants.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Manage' }, { label: 'Permissions' }]} />

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
          <MetricCard label="Definitions" value={formatInteger(permissions.data?.length)} detail="Permission definitions" tone="healthy" />
          <MetricCard label="Critical" value={formatInteger(permissions.data?.filter((permission) => permission.risk === 'critical').length)} detail="Critical permissions" tone="critical" />
          <MetricCard label="Roles" value={formatInteger(roles.data?.length)} detail="Defined roles" tone="info" />
          <MetricCard label="Temporary grants" value={formatInteger(grants.data?.length)} detail="Lease-based grants" tone="warning" />
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
            title="Permission definitions"
            description="Resource/action definitions with risk classification."
            state={permissions}
            tone="healthy"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Resource</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Risk</TableCell>
                    <TableCell>Description</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((permission) => (
                    <TableRow key={permission.id}>
                      <TableCell sx={{ fontWeight: 600 }}>{permission.resource}</TableCell>
                      <TableCell>{permission.action}</TableCell>
                      <TableCell>
                        <StatusBadge label={permission.risk} tone={toneForStatus(permission.risk)} />
                      </TableCell>
                      <TableCell>{permission.description ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Roles"
            description="Role definitions and permission assignments."
            state={roles}
            tone="info"
            renderContent={(catalog) => (
              <Stack spacing={2}>
                <KeyValueList items={[{ label: 'Roles', value: formatInteger(catalog.length) }, { label: 'Permissions assigned', value: formatInteger(catalog.reduce((total, role) => total + role.permissions.length, 0)) }]} />
                <Divider />
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Permissions</TableCell>
                      <TableCell>Members</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {catalog.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell sx={{ fontWeight: 600 }}>{role.name}</TableCell>
                        <TableCell>{compactList(role.permissions)}</TableCell>
                        <TableCell>{role.permissions.length}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Stack>
            )}
          />

          <LoadableCard
            title="Temporary grants"
            description="Lease-based permissions that expire automatically."
            state={grants}
            tone="warning"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Principal</TableCell>
                    <TableCell>Permission</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell>Uses</TableCell>
                    <TableCell>Expires</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((grant) => (
                    <TableRow key={grant.id}>
                      <TableCell sx={{ fontWeight: 600 }}>{grant.principalId}</TableCell>
                      <TableCell>{grant.permission}</TableCell>
                      <TableCell>{grant.reason}</TableCell>
                      <TableCell>{grant.uses}</TableCell>
                      <TableCell>{formatDateTime(grant.expiresAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Risk posture"
            description="At-a-glance view of the authorization surface."
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
                  {catalog.slice(0, 12).map((permission) => (
                    <StatusBadge key={permission.id} label={`${permission.resource}:${permission.action}`} tone={toneForStatus(permission.risk)} />
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

