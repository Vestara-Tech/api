import type {
  ApplicationView,
  ComponentView,
  ConfigContributionView,
  ConfigFieldView,
  ConfigSchemaView,
  DashboardView,
  FileWorkspaceView,
  GeneratorDescriptorView,
  PageDefinitionView,
  ResolvedConfigValueView,
  TemplateView,
  ThemeView,
} from '../../api/contracts.js';

function distinctCount(values: readonly string[]): number {
  return new Set(values).size;
}

export interface ComponentsSummary {
  readonly totalComponents: number;
  readonly readyComponents: number;
  readonly uniqueCapabilities: number;
  readonly totalSlots: number;
  readonly totalEvents: number;
}

export function summarizeComponents(components: readonly ComponentView[]): ComponentsSummary {
  return {
    totalComponents: components.length,
    readyComponents: components.filter((component) => component.status === 'ready').length,
    uniqueCapabilities: distinctCount(components.flatMap((component) => component.capabilities)),
    totalSlots: components.reduce((sum, component) => sum + component.slots.length, 0),
    totalEvents: components.reduce((sum, component) => sum + component.events.length, 0),
  };
}

export interface TemplatesSummary {
  readonly totalTemplates: number;
  readonly themedTemplates: number;
  readonly totalParameters: number;
  readonly uniqueRequiredCapabilities: number;
  readonly totalTags: number;
}

export function summarizeTemplates(templates: readonly TemplateView[]): TemplatesSummary {
  return {
    totalTemplates: templates.length,
    themedTemplates: templates.filter((template) => template.recommendedThemeId !== undefined).length,
    totalParameters: templates.reduce((sum, template) => sum + template.parameters.length, 0),
    uniqueRequiredCapabilities: distinctCount(templates.flatMap((template) => template.requiredCapabilities)),
    totalTags: templates.reduce((sum, template) => sum + template.tags.length, 0),
  };
}

export interface PagesSummary {
  readonly totalPages: number;
  readonly authRequiredPages: number;
  readonly totalNodes: number;
  readonly totalDataSources: number;
  readonly totalActions: number;
}

export function summarizePages(pages: readonly PageDefinitionView[]): PagesSummary {
  return {
    totalPages: pages.length,
    authRequiredPages: pages.filter((page) => page.metadata.authRequired).length,
    totalNodes: pages.reduce((sum, page) => sum + page.nodes.length, 0),
    totalDataSources: pages.reduce((sum, page) => sum + page.dataSources.length, 0),
    totalActions: pages.reduce((sum, page) => sum + page.actions.length, 0),
  };
}

export interface DashboardsSummary {
  readonly totalDashboards: number;
  readonly publishedDashboards: number;
  readonly totalWidgets: number;
  readonly totalPlacements: number;
  readonly scopes: number;
}

export function summarizeDashboards(dashboards: readonly DashboardView[]): DashboardsSummary {
  return {
    totalDashboards: dashboards.length,
    publishedDashboards: dashboards.filter((dashboard) => dashboard.publishedAt !== undefined).length,
    totalWidgets: dashboards.reduce((sum, dashboard) => sum + dashboard.widgets.length, 0),
    totalPlacements: dashboards.reduce((sum, dashboard) => sum + dashboard.layout.placements.length, 0),
    scopes: distinctCount(dashboards.map((dashboard) => dashboard.scope)),
  };
}

export interface ApplicationsSummary {
  readonly totalApplications: number;
  readonly publishedApplications: number;
  readonly authEnabledApplications: number;
  readonly integratedApplications: number;
  readonly totalRoutes: number;
  readonly totalPages: number;
}

export function summarizeApplications(applications: readonly ApplicationView[]): ApplicationsSummary {
  return {
    totalApplications: applications.length,
    publishedApplications: applications.filter((application) => application.lifecycle === 'published').length,
    authEnabledApplications: applications.filter((application) => application.authentication.enabled).length,
    integratedApplications: applications.filter((application) => application.integrations.length > 0).length,
    totalRoutes: applications.reduce((sum, application) => sum + application.routes.length, 0),
    totalPages: applications.reduce((sum, application) => sum + application.pages.length, 0),
  };
}

export interface GeneratorSummary {
  readonly totalGenerators: number;
  readonly uniqueCapabilities: number;
  readonly secretGenerators: number;
  readonly distinctVersions: number;
}

export function summarizeGenerators(generators: readonly GeneratorDescriptorView[]): GeneratorSummary {
  return {
    totalGenerators: generators.length,
    uniqueCapabilities: distinctCount(generators.flatMap((generator) => generator.capabilities)),
    secretGenerators: generators.filter((generator) => generator.requiresSecrets).length,
    distinctVersions: distinctCount(generators.map((generator) => generator.version)),
  };
}

export interface ThemeSummary {
  readonly totalThemes: number;
  readonly darkThemes: number;
  readonly lightThemes: number;
  readonly systemThemes: number;
  readonly totalTokens: number;
}

export function summarizeThemes(themes: readonly ThemeView[]): ThemeSummary {
  return {
    totalThemes: themes.length,
    darkThemes: themes.filter((theme) => theme.mode === 'dark').length,
    lightThemes: themes.filter((theme) => theme.mode === 'light').length,
    systemThemes: themes.filter((theme) => theme.mode === 'system').length,
    totalTokens: themes.reduce((sum, theme) => sum + Object.keys(theme.tokens).length, 0),
  };
}

export interface FilesSummary {
  readonly totalWorkspaces: number;
  readonly providers: number;
  readonly includeRules: number;
  readonly excludeRules: number;
  readonly latestRevision: number;
}

export function summarizeFiles(workspaces: readonly FileWorkspaceView[]): FilesSummary {
  return {
    totalWorkspaces: workspaces.length,
    providers: distinctCount(workspaces.map((workspace) => workspace.providerId)),
    includeRules: workspaces.reduce((sum, workspace) => sum + (workspace.include?.length ?? 0), 0),
    excludeRules: workspaces.reduce((sum, workspace) => sum + (workspace.exclude?.length ?? 0), 0),
    latestRevision: workspaces.reduce((max, workspace) => Math.max(max, workspace.revision), 0),
  };
}

export interface ConfigurationSummary {
  readonly totalSchemas: number;
  readonly totalFields: number;
  readonly totalContributions: number;
  readonly totalResolved: number;
  readonly secretFields: number;
  readonly requiredFields: number;
  readonly highRiskFields: number;
  readonly contributedFields: number;
}

export interface ConfigurationInputs {
  readonly schemas: readonly ConfigSchemaView[];
  readonly fields: readonly ConfigFieldView[];
  readonly contributions: readonly ConfigContributionView[];
  readonly resolved: readonly ResolvedConfigValueView[];
}

export function summarizeConfiguration(inputs: ConfigurationInputs): ConfigurationSummary {
  return {
    totalSchemas: inputs.schemas.length,
    totalFields: inputs.fields.length,
    totalContributions: inputs.contributions.length,
    totalResolved: inputs.resolved.length,
    secretFields: inputs.fields.filter((field) => field.secret === true).length,
    requiredFields: inputs.fields.filter((field) => field.required === true).length,
    highRiskFields: inputs.fields.filter((field) => field.risk === 'high' || field.risk === 'critical').length,
    contributedFields: inputs.contributions.reduce((sum, contribution) => sum + contribution.fields.length, 0),
  };
}
