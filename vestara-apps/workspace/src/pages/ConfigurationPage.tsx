import { Box, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { PageContainer, StatusBadge, type StatusTone } from '@vestara/ui';

import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { useWorkspaceApiClient } from '../app/hooks/useWorkspaceApiClient.js';
import { compactList, formatInteger, formatUnknownValue } from '../app/utils/format.js';
import { summarizeConfiguration } from '../app/utils/summaries.js';

function riskTone(risk: string): StatusTone {
  switch (risk) {
    case 'high':
    case 'critical':
      return 'warning';
    case 'medium':
      return 'info';
    case 'low':
      return 'healthy';
    default:
      return 'neutral';
  }
}

function secretTone(secret: boolean): StatusTone {
  return secret ? 'warning' : 'healthy';
}

export function ConfigurationPage() {
  const client = useWorkspaceApiClient();
  const schemas = useAsyncState((signal) => client.listConfigSchemas(signal), [client]);
  const fields = useAsyncState((signal) => client.listConfigFields(signal), [client]);
  const contributions = useAsyncState((signal) => client.listConfigContributions(signal), [client]);
  const resolved = useAsyncState((signal) => client.listConfigResolved(signal), [client]);
  const summary = summarizeConfiguration({
    schemas: schemas.data ?? [],
    fields: fields.data ?? [],
    contributions: contributions.data ?? [],
    resolved: resolved.data ?? [],
  });

  return (
    <PageContainer title="Configuration" description="Configuration schemas, field inventory, contributions, and resolved values.">
      <Stack spacing={2.5}>
        <PageBreadcrumbs
          items={[
            { label: 'Workspace', href: '/workspace/overview' },
            { label: 'System' },
            { label: 'Configuration' },
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
          <MetricCard label="Namespaces" value={formatInteger(summary.totalSchemas)} detail="Registered configuration namespaces" />
          <MetricCard label="Fields" value={formatInteger(summary.totalFields)} detail="Resolved field definitions" />
          <MetricCard label="Contributions" value={formatInteger(summary.totalContributions)} detail="Configuration contribution packages" />
          <MetricCard label="Resolved values" value={formatInteger(summary.totalResolved)} detail="Resolved configuration entries" />
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
          <MetricCard label="Secrets" value={formatInteger(summary.secretFields)} detail="Secret configuration fields" />
          <MetricCard label="Required" value={formatInteger(summary.requiredFields)} detail="Required configuration fields" />
          <MetricCard label="High risk" value={formatInteger(summary.highRiskFields)} detail="High-risk configuration fields" />
          <MetricCard label="Contributed fields" value={formatInteger(summary.contributedFields)} detail="Field definitions contributed by packages" />
        </Box>

        <LoadableCard
          title="Configuration schemas"
          description="Registered namespaces and secret field coverage."
          state={schemas}
          renderContent={(data) => (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Namespace</TableCell>
                    <TableCell>Version</TableCell>
                    <TableCell>Scope</TableCell>
                    <TableCell>Secret fields</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.length > 0 ? (
                    data.map((schema) => (
                      <TableRow key={schema.namespace} hover>
                        <TableCell sx={{ fontWeight: 700 }}>{schema.namespace}</TableCell>
                        <TableCell>{schema.version}</TableCell>
                        <TableCell>{compactList(schema.scope)}</TableCell>
                        <TableCell>{compactList(schema.secretFields ?? [])}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Typography variant="body2" color="text.secondary">
                          No configuration schemas were returned.
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
          title="Resolved values"
          description="Resolved values with scope and provenance."
          state={resolved}
          renderContent={(data) => (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Key</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell>Scope</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Secret</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.length > 0 ? (
                    data.map((entry) => (
                      <TableRow key={entry.key} hover>
                        <TableCell sx={{ fontWeight: 700 }}>{entry.key}</TableCell>
                        <TableCell>{entry.secret ? '••••••' : formatUnknownValue(entry.value)}</TableCell>
                        <TableCell>{entry.scope}</TableCell>
                        <TableCell>{entry.source}</TableCell>
                        <TableCell>
                          <StatusBadge label={entry.secret ? 'Yes' : 'No'} tone={secretTone(entry.secret)} />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography variant="body2" color="text.secondary">
                          No resolved configuration values were returned.
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
            title="Field inventory"
            description="Operational metadata for declared configuration fields."
            state={fields}
            renderContent={(data) => (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Key</TableCell>
                      <TableCell>Title</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Required</TableCell>
                      <TableCell>Secret</TableCell>
                      <TableCell>Reload</TableCell>
                      <TableCell>Risk</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.length > 0 ? (
                      data.map((field) => (
                        <TableRow key={field.key} hover>
                          <TableCell sx={{ fontWeight: 700 }}>{field.key}</TableCell>
                          <TableCell>{field.title}</TableCell>
                          <TableCell>{field.type}</TableCell>
                          <TableCell>
                            <StatusBadge label={field.required === true ? 'Required' : 'Optional'} tone={field.required === true ? 'warning' : 'healthy'} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge label={field.secret === true ? 'Secret' : 'Visible'} tone={secretTone(field.secret === true)} />
                          </TableCell>
                          <TableCell>{field.reloadBehavior}</TableCell>
                          <TableCell>
                            <StatusBadge label={field.risk} tone={riskTone(field.risk)} />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <Typography variant="body2" color="text.secondary">
                            No configuration fields were returned.
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
            title="Contribution packages"
            description="Package-level contributions and declared field counts."
            state={contributions}
            renderContent={(data) => (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Package</TableCell>
                      <TableCell>Namespace</TableCell>
                      <TableCell>Version</TableCell>
                      <TableCell align="right">Fields</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.length > 0 ? (
                      data.map((contribution) => (
                        <TableRow key={`${contribution.packageId}:${contribution.namespace}`} hover>
                          <TableCell sx={{ fontWeight: 700 }}>{contribution.packageId}</TableCell>
                          <TableCell>{contribution.namespace}</TableCell>
                          <TableCell>{contribution.version}</TableCell>
                          <TableCell align="right">{formatInteger(contribution.fields.length)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <Typography variant="body2" color="text.secondary">
                            No configuration contributions were returned.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>
            )}
          />
        </Box>

        <LoadableCard
          title="Selected configuration package"
          description="Detailed view of the first contribution package."
          state={contributions}
          renderContent={(data) => {
            const contribution = data[0];

            if (contribution === undefined) {
              return (
                <Typography variant="body2" color="text.secondary">
                  No contribution details available.
                </Typography>
              );
            }

            return (
              <Stack spacing={1.5}>
                <KeyValueList
                  items={[
                    { label: 'Package id', value: contribution.packageId },
                    { label: 'Namespace', value: contribution.namespace },
                    { label: 'Version', value: contribution.version },
                    { label: 'Fields', value: formatInteger(contribution.fields.length) },
                    { label: 'Field keys', value: compactList(contribution.fields.map((field) => field.key)) },
                  ]}
                />
              </Stack>
            );
          }}
        />
      </Stack>
    </PageContainer>
  );
}
