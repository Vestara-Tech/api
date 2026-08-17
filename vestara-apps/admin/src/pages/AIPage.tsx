import { Box, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';

import { PageContainer, StatusBadge } from '@vestara/ui';

import { PageBreadcrumbs } from '../app/components/PageBreadcrumbs.js';
import { KeyValueList } from '../app/components/KeyValueList.js';
import { LoadableCard } from '../app/components/LoadableCard.js';
import { MetricCard } from '../app/components/MetricCard.js';
import { useAdminApiClient } from '../app/hooks/useAdminApiClient.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { compactList, formatDateTime, formatDurationMs, formatInteger } from '../app/utils/format.js';
import { toneForStatus } from '../app/utils/status.js';

function enabledModelCapabilities(capabilities: {
  readonly reasoning: boolean;
  readonly tools: boolean;
  readonly structuredOutput: boolean;
  readonly functionCalling: boolean;
  readonly vision: boolean;
  readonly embeddings: boolean;
  readonly streaming: boolean;
}): readonly string[] {
  return [
    capabilities.reasoning ? 'reasoning' : undefined,
    capabilities.tools ? 'tools' : undefined,
    capabilities.structuredOutput ? 'structured' : undefined,
    capabilities.functionCalling ? 'functions' : undefined,
    capabilities.vision ? 'vision' : undefined,
    capabilities.embeddings ? 'embeddings' : undefined,
    capabilities.streaming ? 'streaming' : undefined,
  ].filter((value): value is string => value !== undefined);
}

export function AIPage() {
  const client = useAdminApiClient();

  const providers = useAsyncState((signal) => client.listAiProviders(signal), [client]);
  const models = useAsyncState((signal) => client.listAiModels(signal), [client]);
  const usage = useAsyncState((signal) => client.listAiUsage(signal), [client]);
  const capabilities = useAsyncState((signal) => client.listAiCapabilities(signal), [client]);

  const enabledProviders = providers.data?.filter((provider) => provider.enabled).length;
  const reasoningModels = models.data?.filter((model) => model.capabilities.reasoning).length;
  const visionModels = models.data?.filter((model) => model.capabilities.vision).length;

  return (
    <PageContainer title="AI" description="Providers, models, routing, capabilities, and usage.">
      <Stack spacing={2}>
        <PageBreadcrumbs items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Platform' }, { label: 'AI' }]} />

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
          <MetricCard label="Providers" value={formatInteger(providers.data?.length)} detail="Registered AI providers" tone="healthy" />
          <MetricCard label="Enabled" value={formatInteger(enabledProviders)} detail="Providers available for routing" tone="info" />
          <MetricCard label="Models" value={formatInteger(models.data?.length)} detail="Catalogued models" tone="warning" />
          <MetricCard label="Usage" value={formatInteger(usage.data?.length)} detail="Recent usage records" tone="neutral" />
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
            title="Providers"
            description="Registry-backed provider inventory."
            state={providers}
            tone="healthy"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Enabled</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell>Endpoint</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((provider) => (
                    <TableRow key={provider.id}>
                      <TableCell sx={{ fontWeight: 600 }}>{provider.name}</TableCell>
                      <TableCell>{provider.type}</TableCell>
                      <TableCell>
                        <StatusBadge label={provider.enabled ? 'Enabled' : 'Disabled'} tone={provider.enabled ? 'healthy' : 'warning'} />
                      </TableCell>
                      <TableCell>{provider.priority}</TableCell>
                      <TableCell>{provider.apiEndpoint ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Models"
            description="Available model inventory with capability flags."
            state={models}
            tone="info"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Model</TableCell>
                    <TableCell>Provider</TableCell>
                    <TableCell>Capabilities</TableCell>
                    <TableCell>Context</TableCell>
                    <TableCell>Lifecycle</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((model) => (
                    <TableRow key={`${model.providerId}:${model.id}`}>
                      <TableCell sx={{ fontWeight: 600 }}>{model.name}</TableCell>
                      <TableCell>{model.providerId}</TableCell>
                      <TableCell>{compactList(enabledModelCapabilities(model.capabilities))}</TableCell>
                      <TableCell>{formatInteger(model.contextWindow)}</TableCell>
                      <TableCell>
                        <StatusBadge label={model.lifecycleStatus} tone={toneForStatus(model.lifecycleStatus)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Usage"
            description="Recent provider/model usage and token flow."
            state={usage}
            tone="warning"
            renderContent={(catalog) => (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Request</TableCell>
                    <TableCell>Consumer</TableCell>
                    <TableCell>Model</TableCell>
                    <TableCell>Tokens</TableCell>
                    <TableCell>Latency</TableCell>
                    <TableCell>Fallbacks</TableCell>
                    <TableCell>Completed</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {catalog.map((entry) => (
                    <TableRow key={entry.requestId}>
                      <TableCell sx={{ fontWeight: 600 }}>{entry.requestId.slice(0, 12)}</TableCell>
                      <TableCell>{entry.consumerId}</TableCell>
                      <TableCell>{`${entry.providerId}/${entry.modelId}`}</TableCell>
                      <TableCell>{`${formatInteger(entry.inputTokens)} → ${formatInteger(entry.outputTokens)}`}</TableCell>
                      <TableCell>{formatDurationMs(entry.latencyMs)}</TableCell>
                      <TableCell>{formatInteger(entry.fallbackCount)}</TableCell>
                      <TableCell>{formatDateTime(entry.completedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <LoadableCard
            title="Capability surface"
            description="AI permission and routing capabilities discovered from the backend."
            state={capabilities}
            tone="neutral"
            renderContent={(catalog) => (
              <Stack spacing={2}>
                <KeyValueList
                  items={[
                    { label: 'Capabilities', value: formatInteger(catalog.length) },
                    { label: 'Reasoning models', value: formatInteger(reasoningModels) },
                    { label: 'Vision models', value: formatInteger(visionModels) },
                  ]}
                />
                <Divider />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {catalog.map((capability) => (
                    <StatusBadge key={capability.id} label={capability.name} tone={toneForStatus(capability.risk)} />
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
