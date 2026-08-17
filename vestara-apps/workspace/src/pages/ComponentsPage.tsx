import { Box, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { PageContainer, StatusBadge, type StatusTone } from '@vestara/ui';

import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { useWorkspaceApiClient } from '../app/hooks/useWorkspaceApiClient.js';
import { compactList, formatInteger } from '../app/utils/format.js';
import { summarizeComponents } from '../app/utils/summaries.js';

function componentTone(status: string): StatusTone {
  switch (status) {
    case 'ready':
    case 'published':
      return 'healthy';
    case 'draft':
    case 'review':
    case 'testing':
    case 'deprecated':
      return 'warning';
    case 'invalid':
    case 'failed':
      return 'critical';
    default:
      return 'neutral';
  }
}

export function ComponentsPage() {
  const client = useWorkspaceApiClient();
  const components = useAsyncState((signal) => client.listComponents(signal), [client]);
  const categories = useAsyncState((signal) => client.listComponentCategories(signal), [client]);
  const summary = summarizeComponents(components.data ?? []);
  const firstComponent = components.data?.[0];

  return (
    <PageContainer title="Components" description="Component registry, category coverage, and component capability inventory.">
      <Stack spacing={2.5}>
        <PageBreadcrumbs
          items={[
            { label: 'Workspace', href: '/workspace/overview' },
            { label: 'Compose' },
            { label: 'Components' },
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
          <MetricCard label="Components" value={formatInteger(summary.totalComponents)} detail="Composable component definitions" />
          <MetricCard label="Categories" value={formatInteger(categories.data?.length)} detail="Component category coverage" />
          <MetricCard label="Ready" value={formatInteger(summary.readyComponents)} detail="Components marked ready" />
          <MetricCard label="Capabilities" value={formatInteger(summary.uniqueCapabilities)} detail="Unique declared capabilities" />
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
          <MetricCard label="Slots" value={formatInteger(summary.totalSlots)} detail="Declared slot surface" />
          <MetricCard label="Events" value={formatInteger(summary.totalEvents)} detail="Declared event surface" />
        </Box>

        <LoadableCard
          title="Component catalog"
          description="Canonical component inventory exposed by the backend component module."
          state={components}
          renderContent={(data) => (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Version</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Capabilities</TableCell>
                    <TableCell align="right">Slots</TableCell>
                    <TableCell align="right">Events</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.length > 0 ? (
                    data.map((component) => (
                      <TableRow key={component.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {component.displayName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {component.id}
                          </Typography>
                        </TableCell>
                        <TableCell>{component.category}</TableCell>
                        <TableCell>{component.version}</TableCell>
                        <TableCell>
                          <StatusBadge label={component.status} tone={componentTone(component.status)} />
                        </TableCell>
                        <TableCell>{compactList(component.capabilities)}</TableCell>
                        <TableCell align="right">{formatInteger(component.slots.length)}</TableCell>
                        <TableCell align="right">{formatInteger(component.events.length)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Typography variant="body2" color="text.secondary">
                          No components have been registered yet.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
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
            title="Category coverage"
            description="Component counts per category."
            state={categories}
            renderContent={(data) => (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Category</TableCell>
                      <TableCell align="right">Count</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.length > 0 ? (
                      data.map((category) => (
                        <TableRow key={category.name} hover>
                          <TableCell>{category.name}</TableCell>
                          <TableCell align="right">{formatInteger(category.count)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2}>
                          <Typography variant="body2" color="text.secondary">
                            No categories were returned.
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
            title="Selected component"
            description="The first component in the catalog with key structural details."
            state={components}
            renderContent={(data) => {
              const component = data[0];

              if (component === undefined) {
                return (
                  <Typography variant="body2" color="text.secondary">
                    No component details available.
                  </Typography>
                );
              }

              return (
                <Stack spacing={1.5}>
                  <KeyValueList
                    items={[
                      { label: 'Display name', value: component.displayName },
                      { label: 'Identifier', value: component.id },
                      { label: 'Category', value: component.category },
                      { label: 'Version', value: component.version },
                      { label: 'Status', value: <StatusBadge label={component.status} tone={componentTone(component.status)} /> },
                      { label: 'Capabilities', value: compactList(component.capabilities) },
                      { label: 'Slots', value: formatInteger(component.slots.length) },
                      { label: 'Events', value: formatInteger(component.events.length) },
                    ]}
                  />

                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                      Slots and events
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Slots: {compactList(component.slots.map((slot) => slot.name))}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Events: {compactList(component.events.map((event) => `${event.name} (${event.kind})`))}
                    </Typography>
                  </Box>
                </Stack>
              );
            }}
          />
        </Box>
      </Stack>
    </PageContainer>
  );
}
