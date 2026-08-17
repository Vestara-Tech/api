import { Box, Divider, Stack, Typography } from '@mui/material';

import { PageContainer, StatusBadge } from '@vestara/ui';

import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { useAdminApiClient } from '../app/hooks/useAdminApiClient.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { formatDateTime, formatInteger } from '../app/utils/format.js';
import { toneForStatus } from '../app/utils/status.js';
import type { AuthIdentityView, AuthSessionView } from '../api/contracts.js';

type AuthIdentityState =
  | { readonly signedIn: true; readonly identity: AuthIdentityView }
  | { readonly signedIn: false; readonly message: string };

type AuthSessionsState =
  | { readonly signedIn: true; readonly sessions: readonly AuthSessionView[] }
  | { readonly signedIn: false; readonly message: string };

function authFallbackMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Authentication unavailable';
  if (message.includes('(401)')) return 'Bearer authentication is required to inspect identity and sessions.';
  return message;
}

export function AuthenticationPage() {
  const client = useAdminApiClient();

  const identity = useAsyncState<AuthIdentityState>(async (signal) => {
    try {
      return { signedIn: true, identity: await client.getAuthMe(signal) };
    } catch (error) {
      if (error instanceof Error && error.message.includes('(401)')) {
        return { signedIn: false, message: authFallbackMessage(error) };
      }
      throw error;
    }
  }, [client]);

  const sessions = useAsyncState<AuthSessionsState>(async (signal) => {
    try {
      return { signedIn: true, sessions: await client.listAuthSessions(signal) };
    } catch (error) {
      if (error instanceof Error && error.message.includes('(401)')) {
        return { signedIn: false, message: authFallbackMessage(error) };
      }
      throw error;
    }
  }, [client]);

  const currentStatus = identity.data?.signedIn === true ? identity.data.identity.status : 'unauthenticated';

  return (
    <PageContainer
      title="Authentication"
      description="Identity, sessions, and permission-check contract visibility."
      actions={<StatusBadge label={identity.data?.signedIn === true ? 'Signed in' : 'Authentication required'} tone={identity.data?.signedIn === true ? 'healthy' : 'warning'} />}
    >
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Manage' }, { label: 'Authentication' }]} />

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
          <MetricCard label="Identity" value={identity.data?.signedIn === true ? identity.data.identity.id : '—'} detail={identity.data?.signedIn === true ? identity.data.identity.principalKind : identity.data?.message ?? 'Awaiting auth'} tone={identity.data?.signedIn === true ? 'healthy' : 'warning'} />
          <MetricCard label="Status" value={currentStatus} detail={identity.data?.signedIn === true ? identity.data.identity.profile.displayName ?? 'Identity loaded' : 'Bearer token required'} tone={toneForStatus(currentStatus)} />
          <MetricCard label="Sessions" value={sessions.data?.signedIn === true ? formatInteger(sessions.data.sessions.length) : '—'} detail={sessions.data?.signedIn === true ? 'Active sessions' : sessions.data?.message ?? 'Awaiting auth'} tone={sessions.data?.signedIn === true ? 'info' : 'warning'} />
          <MetricCard label="Permission check" value={identity.data?.signedIn === true ? 'Available' : 'Unavailable'} detail="Auth / check endpoint" tone={identity.data?.signedIn === true ? 'healthy' : 'warning'} />
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
            title="Current identity"
            description="Authenticated identity or the configured auth requirement."
            state={identity}
            tone={identity.data?.signedIn === true ? 'healthy' : 'warning'}
            renderContent={(state) =>
              state.signedIn ? (
                <Stack spacing={2}>
                  <KeyValueList
                    items={[
                      { label: 'Identity id', value: state.identity.id },
                      { label: 'Principal kind', value: state.identity.principalKind },
                      { label: 'Status', value: state.identity.status },
                      { label: 'Display name', value: state.identity.profile.displayName ?? '—' },
                      { label: 'Primary email', value: state.identity.profile.primaryEmail ?? '—' },
                    ]}
                  />
                  <Divider />
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    {state.identity.roles.map((role) => (
                      <StatusBadge key={role} label={role} tone="info" />
                    ))}
                    {state.identity.permissions.slice(0, 8).map((permission) => (
                      <StatusBadge key={permission} label={permission} tone="neutral" />
                    ))}
                  </Stack>
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {state.message}
                </Typography>
              )
            }
          />

          <LoadableCard
            title="Sessions"
            description="Active sessions for the current identity."
            state={sessions}
            tone={sessions.data?.signedIn === true ? 'info' : 'warning'}
            renderContent={(state) =>
              state.signedIn ? (
                <Stack spacing={1.25}>
                  {state.sessions.map((session) => (
                    <Stack key={session.id} direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {session.authenticationMethod}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {session.id} · expires {formatDateTime(session.expiresAt)}
                        </Typography>
                      </Stack>
                      <StatusBadge label={session.assuranceLevel} tone={toneForStatus(session.assuranceLevel)} />
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {state.message}
                </Typography>
              )
            }
          />
        </Box>
      </Stack>
    </PageContainer>
  );
}

