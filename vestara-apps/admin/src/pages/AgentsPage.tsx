import { Box, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { PageContainer, StatusBadge } from '@vestara/ui';

import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { useAdminApiClient } from '../app/hooks/useAdminApiClient.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { compactList, formatInteger } from '../app/utils/format.js';
import { toneForStatus } from '../app/utils/status.js';

export function AgentsPage() {
  const client = useAdminApiClient();

  const agents = useAsyncState((signal) => client.listAgents(signal), [client]);
  const tools = useAsyncState((signal) => client.listTools(signal), [client]);
  const skills = useAsyncState((signal) => client.listSkills(signal), [client]);

  return (
    <PageContainer title="Agents" description="Operational agent catalog, tool footprint, and skill availability.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Platform' }, { label: 'Agents' }]} />

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
          <MetricCard label="Agents" value={formatInteger(agents.data?.length)} detail="Registered agent definitions" tone="healthy" />
          <MetricCard label="Tools" value={formatInteger(tools.data?.length)} detail="Executable tools" tone="info" />
          <MetricCard label="Skills" value={formatInteger(skills.data?.length)} detail="Reusable skills" tone="warning" />
          <MetricCard
            label="Permissions"
            value={formatInteger(agents.data?.reduce((total, agent) => total + agent.permissions.length, 0))}
            detail="Agent-to-permission assignments"
            tone="neutral"
          />
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
            title="Agent catalog"
            description="Registered agents and their current footprint."
            state={agents}
            tone="healthy"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Version</TableCell>
                    <TableCell>Tools</TableCell>
                    <TableCell>Skills</TableCell>
                    <TableCell>Permissions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell sx={{ fontWeight: 600 }}>
                        <Stack spacing={0.25}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {agent.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {agent.id}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{agent.role}</TableCell>
                      <TableCell>{agent.version}</TableCell>
                      <TableCell>{agent.tools.length}</TableCell>
                      <TableCell>{agent.skills.length}</TableCell>
                      <TableCell>{agent.permissions.length}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Tool catalog"
            description="Tools available to agents."
            state={tools}
            tone="info"
            renderContent={(catalog) => (
              <Stack spacing={2}>
                <KeyValueList items={[{ label: 'Tools', value: formatInteger(catalog.length) }, { label: 'Risky tools', value: formatInteger(catalog.filter((tool) => tool.risk !== 'low').length) }]} />
                <Divider />
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Version</TableCell>
                      <TableCell>Risk</TableCell>
                      <TableCell>Capabilities</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {catalog.slice(0, 12).map((tool) => (
                      <TableRow key={tool.id}>
                        <TableCell sx={{ fontWeight: 600 }}>{tool.id}</TableCell>
                        <TableCell>{tool.version}</TableCell>
                        <TableCell>
                          <StatusBadge label={tool.risk} tone={toneForStatus(tool.risk)} />
                        </TableCell>
                        <TableCell>{compactList(tool.capabilities)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Stack>
            )}
          />

          <LoadableCard
            title="Skill catalog"
            description="Skill definitions and capability requirements."
            state={skills}
            tone="warning"
            renderContent={(catalog) => (
              <Stack spacing={2}>
                <KeyValueList items={[{ label: 'Skills', value: formatInteger(catalog.length) }, { label: 'Role-specific skills', value: formatInteger(catalog.filter((skill) => skill.compatibleRoles !== undefined).length) }]} />
                <Divider />
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Version</TableCell>
                      <TableCell>Capabilities</TableCell>
                      <TableCell>Roles</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {catalog.slice(0, 12).map((skill) => (
                      <TableRow key={skill.id}>
                        <TableCell sx={{ fontWeight: 600 }}>{skill.name}</TableCell>
                        <TableCell>{skill.version}</TableCell>
                        <TableCell>{compactList(skill.requiredCapabilities)}</TableCell>
                        <TableCell>{skill.compatibleRoles === undefined ? '—' : compactList(skill.compatibleRoles)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Stack>
            )}
          />
        </Box>
      </Stack>
    </PageContainer>
  );
}
