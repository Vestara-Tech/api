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

export function UsersPage() {
  const client = useAdminApiClient();

  const users = useAsyncState((signal) => client.listUsers(signal), [client]);

  return (
    <PageContainer title="Users" description="Human account inventory, memberships, and account status.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Manage' }, { label: 'Users' }]} />

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
          <MetricCard label="Users" value={formatInteger(users.data?.length)} detail="Human account records" tone="healthy" />
          <MetricCard label="Active" value={formatInteger(users.data?.filter((user) => user.status === 'active').length)} detail="Active users" tone="healthy" />
          <MetricCard label="Verified emails" value={formatInteger(users.data?.filter((user) => user.settings.emailVerified).length)} detail="Email verified" tone="info" />
          <MetricCard label="Suspended" value={formatInteger(users.data?.filter((user) => user.status !== 'active').length)} detail="Non-active accounts" tone="warning" />
        </Box>

        <LoadableCard
          title="User catalog"
          description="Provisioned users, lifecycle state, and memberships."
          state={users}
          tone="healthy"
          renderContent={(catalog) => (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Verified</TableCell>
                  <TableCell>Memberships</TableCell>
                  <TableCell>Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {catalog.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell sx={{ fontWeight: 600 }}>
                      <Stack spacing={0.25}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {user.profile.displayName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          @{user.username}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <StatusBadge label={user.status} tone={toneForStatus(user.status)} />
                    </TableCell>
                    <TableCell>{user.settings.email ?? '—'}</TableCell>
                    <TableCell>{user.settings.emailVerified ? 'Yes' : 'No'}</TableCell>
                    <TableCell>{user.memberships.length}</TableCell>
                    <TableCell>{formatDateTime(user.updatedAt)}</TableCell>
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
            title="User details"
            description="Selected account details and preferences summary."
            state={users}
            tone="info"
            renderContent={(catalog) => {
              const selected = catalog[0];
              if (selected === undefined) {
                return null;
              }

              return (
                <Stack spacing={2}>
                  <KeyValueList
                    items={[
                      { label: 'Identity', value: selected.identityId },
                      { label: 'Locale', value: selected.profile.locale ?? '—' },
                      { label: 'Timezone', value: selected.profile.timezone ?? '—' },
                      { label: 'Organization', value: selected.profile.organization ?? '—' },
                      { label: 'Roles', value: selected.memberships.flatMap((membership) => membership.roleIds).length },
                      { label: 'Preferences', value: Object.keys(selected.preferences).length },
                    ]}
                  />
                  <Divider />
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    {selected.memberships.map((membership) => (
                      <StatusBadge key={membership.id} label={`${membership.organizationId} · ${membership.roleIds.length} roles`} tone="neutral" />
                    ))}
                  </Stack>
                </Stack>
              );
            }}
          />

          <LoadableCard
            title="Recent users"
            description="Newest account changes by update timestamp."
            state={users}
            tone="neutral"
            renderContent={(catalog) => (
              <Stack spacing={1}>
                {catalog
                  .slice()
                  .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
                  .slice(0, 6)
                  .map((user) => (
                    <Stack key={user.id} direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {user.profile.displayName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {user.username}
                        </Typography>
                      </Stack>
                      <StatusBadge label={user.status} tone={toneForStatus(user.status)} />
                    </Stack>
                  ))}
              </Stack>
            )}
          />
        </Box>
      </Stack>
    </PageContainer>
  );
}

