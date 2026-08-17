import { Box, Divider, Paper, Stack, Typography } from '@mui/material';

import { PageContainer, StatusBadge, useVestaraThemeSnapshot } from '@vestara/ui';

import { MetricCard } from '../app/components/MetricCard.js';
import { KeyValueList } from '../app/components/KeyValueList.js';
import { useWorkspaceApiClient } from '../app/hooks/useWorkspaceApiClient.js';
import { useAsyncState } from '../app/hooks/useAsyncState.js';
import { compactList, formatInteger } from '../app/utils/format.js';

export function OverviewPage() {
  const client = useWorkspaceApiClient();
  const themeSnapshot = useVestaraThemeSnapshot();

  const capabilities = useAsyncState((signal) => client.getEnabledCapabilities(signal), [client]);
  const components = useAsyncState((signal) => client.listComponents(signal), [client]);
  const componentCategories = useAsyncState((signal) => client.listComponentCategories(signal), [client]);
  const templates = useAsyncState((signal) => client.listTemplates(signal), [client]);
  const templateKinds = useAsyncState((signal) => client.listTemplateKinds(signal), [client]);
  const pages = useAsyncState((signal) => client.listPages(signal), [client]);
  const dashboards = useAsyncState((signal) => client.listDashboards(signal), [client]);
  const applications = useAsyncState((signal) => client.listApplications(signal), [client]);
  const themes = useAsyncState((signal) => client.listThemes(signal), [client]);
  const generators = useAsyncState((signal) => client.listGenerators(signal), [client]);
  const generatorCapabilities = useAsyncState((signal) => client.listGeneratorCapabilities(signal), [client]);
  const fileWorkspaces = useAsyncState((signal) => client.listFileWorkspaces(signal), [client]);
  const configFields = useAsyncState((signal) => client.listConfigFields(signal), [client]);
  const configContributions = useAsyncState((signal) => client.listConfigContributions(signal), [client]);

  const themedTemplates = templates.data?.filter((template) => template.recommendedThemeId !== undefined).length;
  const authRequiredPages = pages.data?.filter((page) => page.metadata.authRequired).length;
  const publishedDashboards = dashboards.data?.filter((dashboard) => dashboard.publishedAt !== undefined).length;
  const publishedApplications = applications.data?.filter((application) => application.lifecycle === 'published').length;
  const fileProviders = new Set(fileWorkspaces.data?.map((workspace) => workspace.providerId) ?? []).size;

  return (
    <PageContainer title="Workspace" description="Authoring and composition control surface for components, templates, pages, dashboards, and applications.">
      <Stack spacing={2.5}>
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
          <MetricCard label="Components" value={formatInteger(components.data?.length)} detail="Composable UI definitions" />
          <MetricCard label="Templates" value={formatInteger(templates.data?.length)} detail="Composable blueprint catalog" />
          <MetricCard label="Pages" value={formatInteger(pages.data?.length)} detail="Declarative page definitions" />
          <MetricCard label="Dashboards" value={formatInteger(dashboards.data?.length)} detail="Dashboard definitions and widgets" />
        </Box>

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
          <MetricCard label="Applications" value={formatInteger(applications.data?.length)} detail="Application definitions and routes" />
          <MetricCard label="Themes" value={formatInteger(themes.data?.length)} detail="Theme registry and tokens" />
          <MetricCard label="Generators" value={formatInteger(generators.data?.length)} detail="Registered generation engines" />
          <MetricCard label="Capabilities" value={formatInteger(capabilities.data?.length)} detail="Enabled backend namespaces" />
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
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Stack spacing={1.5}>
              <Typography variant="h6">Composition map</Typography>
              <Typography variant="body2" color="text.secondary">
                The shell is organized around authored surface types, not runtime operations.
              </Typography>
              <KeyValueList
                items={[
                  { label: 'Theme source', value: themeSnapshot.source },
                  { label: 'Theme id', value: themeSnapshot.themeId },
                  { label: 'Current theme status', value: themeSnapshot.status },
                  { label: 'Templates with theme', value: formatInteger(themedTemplates) },
                  { label: 'Pages requiring auth', value: formatInteger(authRequiredPages) },
                  { label: 'Published dashboards', value: formatInteger(publishedDashboards) },
                  { label: 'Published applications', value: formatInteger(publishedApplications) },
                  { label: 'File providers', value: formatInteger(fileProviders) },
                ]}
              />
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Stack spacing={1.5}>
              <Typography variant="h6">Catalog inventory</Typography>
              <Typography variant="body2" color="text.secondary">
                Current authored assets and backend capability support.
              </Typography>
              <KeyValueList
                items={[
                  { label: 'Component categories', value: formatInteger(componentCategories.data?.length) },
                  { label: 'Template kinds', value: formatInteger(templateKinds.data?.length) },
                  { label: 'Generator capabilities', value: formatInteger(generatorCapabilities.data?.length) },
                  { label: 'Config fields', value: formatInteger(configFields.data?.length) },
                  { label: 'Config contributions', value: formatInteger(configContributions.data?.length) },
                ]}
              />

              <Divider />

              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {capabilities.data?.slice(0, 14).map((capability) => (
                  <StatusBadge key={capability} label={capability} tone="neutral" />
                ))}
              </Stack>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Stack spacing={1.5}>
              <Typography variant="h6">Active surface types</Typography>
              <Typography variant="body2" color="text.secondary">
                The first Workspace release is centered on the authoring domains already present in the backend.
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {['Components', 'Templates', 'Pages', 'Dashboards', 'Applications', 'Generator', 'Themes', 'Files', 'Configuration'].map((label) => (
                  <StatusBadge key={label} label={label} tone="healthy" />
                ))}
              </Stack>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Stack spacing={1.5}>
              <Typography variant="h6">Highlights</Typography>
              <Typography variant="body2" color="text.secondary">
                The catalog is intentionally thin at first; the shell proves the shared UI and capability-aware routing.
              </Typography>
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  Components: {compactList(componentCategories.data?.map((entry) => `${entry.name} (${entry.count})`) ?? [])}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Templates: {compactList(templateKinds.data ?? [])}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Generators: {compactList(generatorCapabilities.data ?? [])}
                </Typography>
              </Stack>
            </Stack>
          </Paper>
        </Box>
      </Stack>
    </PageContainer>
  );
}

