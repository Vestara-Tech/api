import type {
  AuthCheckView,
  AuthIdentityView,
  AuthSessionView,
  AiCapabilityView,
  AiModelView,
  AiProviderView,
  AiUsageView,
  ApplicationModelView,
  ApplicationView,
  DashboardProjectionView,
  DashboardView,
  DashboardWidgetDefinitionView,
  AgentRunView,
  AgentView,
  BrowserEvidenceView,
  BrowserProfileView,
  BrowserRuntimeView,
  BrowserSessionView,
  BuilderDefinitionView,
  BuilderKindView,
  BuilderSessionView,
  ComponentCategoryView,
  ComponentTreeView,
  ComponentView,
  CapabilityRegistrationView,
  ContextProviderView,
  ContextSnapshotView,
  DatabaseConnectionView,
  DatabaseDefinitionView,
  ConfigContributionView,
  ConfigFieldView,
  ConfigImpactView,
  ConfigTransactionView,
  DiagnosticCheckView,
  DiagnosticRunView,
  FileEventView,
  FileWorkspaceView,
  GeneratorDescriptorView,
  PageDefinitionView,
  MarketplaceBundleView,
  MarketplaceContributionView,
  MarketplaceDistributionView,
  MarketplacePublishedView,
  PermissionDefinitionView,
  PermissionDecisionView,
  PermissionRoleView,
  LogRecordView,
  LogStatsView,
  OsCapabilityView,
  OsCurrentView,
  OsDesiredView,
  OsDiffView,
  OsPlanView,
  OsStateView,
  TemplateView,
  ThemeView,
  TestRunView,
  TestPlanView,
  TestRunnerView,
  TestSuiteView,
  StartupSnapshot,
  SystemKernelView,
  SystemOperationView,
  SystemProcessView,
  SystemServiceView,
  SystemSnapshotView,
  SystemStatusView,
  SystemStorageView,
  TaskEventView,
  TaskView,
  ToolView,
  UserView,
  WorkflowRunView,
  WorkflowView,
  SkillView,
  TemporaryGrantView,
} from './contracts.js';

type QueryValue = string | number | boolean | readonly string[] | undefined;

export interface AdminRequestOptions {
  readonly method?: string;
  readonly signal?: AbortSignal | undefined;
  readonly query?: Record<string, QueryValue> | undefined;
  readonly body?: unknown | undefined;
  readonly headers?: HeadersInit | undefined;
}

export class AdminApiClient {
  constructor(private readonly baseUrl: string = '/api') {}

  private url(path: string): string {
    const base = this.baseUrl.replace(/\/$/, '');
    return `${base}${path}`;
  }

  private buildUrl(path: string, query?: Record<string, QueryValue>): string {
    const search = new URLSearchParams();

    if (query !== undefined) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
          for (const entry of value) {
            search.append(key, entry);
          }
          continue;
        }

        search.set(key, String(value));
      }
    }

    const queryString = search.toString();
    return queryString.length > 0 ? `${this.url(path)}?${queryString}` : this.url(path);
  }

  private async requestJson<T>(path: string, options: AdminRequestOptions = {}): Promise<T> {
    const { method = 'GET', signal, query, body, headers } = options;
    const response = await fetch(this.buildUrl(path, query), {
      method,
      ...(signal !== undefined ? { signal } : {}),
      ...(body !== undefined
        ? {
            body: JSON.stringify(body),
            headers: (() => {
              const next = new Headers(headers);
              next.set('content-type', 'application/json');
              return next;
            })(),
          }
        : headers !== undefined
          ? { headers }
          : {}),
    });

    if (!response.ok) {
      throw new Error(`Unable to load ${path} (${response.status})`);
    }

    return (await response.json()) as T;
  }

  async getEnabledCapabilities(signal?: AbortSignal): Promise<readonly string[]> {
    return this.requestJson<readonly string[]>('/v2/capabilities/enabled', { signal });
  }

  async listCapabilities(signal?: AbortSignal): Promise<readonly CapabilityRegistrationView[]> {
    return this.requestJson<readonly CapabilityRegistrationView[]>('/v2/capabilities', { signal });
  }

  async getStartupSnapshot(signal?: AbortSignal): Promise<StartupSnapshot> {
    return this.requestJson<StartupSnapshot>('/v2/startup', { signal });
  }

  async getSystemStatus(signal?: AbortSignal): Promise<SystemStatusView> {
    return this.requestJson<SystemStatusView>('/v2/system', { signal });
  }

  async getSystemSnapshot(signal?: AbortSignal): Promise<SystemSnapshotView> {
    return this.requestJson<SystemSnapshotView>('/v2/system/snapshot', { signal });
  }

  async listSystemServices(signal?: AbortSignal): Promise<readonly SystemServiceView[]> {
    return this.requestJson<readonly SystemServiceView[]>('/v2/system/services', { signal });
  }

  async listSystemProcesses(signal?: AbortSignal): Promise<readonly SystemProcessView[]> {
    return this.requestJson<readonly SystemProcessView[]>('/v2/system/processes', { signal });
  }

  async getSystemKernel(signal?: AbortSignal): Promise<SystemKernelView> {
    return this.requestJson<SystemKernelView>('/v2/system/kernel', { signal });
  }

  async getSystemStorage(signal?: AbortSignal): Promise<SystemStorageView> {
    return this.requestJson<SystemStorageView>('/v2/system/storage', { signal });
  }

  async listSystemOperations(signal?: AbortSignal): Promise<readonly SystemOperationView[]> {
    return this.requestJson<readonly SystemOperationView[]>('/v2/system/operations', { signal });
  }

  async listSystemApprovals(signal?: AbortSignal): Promise<readonly {
    readonly id: string;
    readonly operationId: string;
    readonly kind: string;
    readonly status: string;
    readonly approvals: readonly string[];
    readonly required: number;
    readonly requestedAt: string;
    readonly expiresAt: string;
  }[]> {
    return this.requestJson<readonly {
      readonly id: string;
      readonly operationId: string;
      readonly kind: string;
      readonly status: string;
      readonly approvals: readonly string[];
      readonly required: number;
      readonly requestedAt: string;
      readonly expiresAt: string;
    }[]>('/v2/system/approvals', { signal });
  }

  async getOsCurrent(signal?: AbortSignal): Promise<OsCurrentView> {
    return this.requestJson<OsCurrentView>('/v2/os/current', { signal });
  }

  async getOsDesired(signal?: AbortSignal): Promise<OsDesiredView | undefined> {
    try {
      return await this.requestJson<OsDesiredView>('/v2/os/desired', { signal });
    } catch (error) {
      if (error instanceof Error && error.message.includes('(404)')) return undefined;
      throw error;
    }
  }

  async getOsState(signal?: AbortSignal): Promise<OsStateView> {
    return this.requestJson<OsStateView>('/v2/os/state', { signal });
  }

  async getOsDiff(signal?: AbortSignal): Promise<OsDiffView> {
    return this.requestJson<OsDiffView>('/v2/os/diff', { signal });
  }

  async getOsPlan(signal?: AbortSignal): Promise<OsPlanView> {
    return this.requestJson<OsPlanView>('/v2/os/plan', { signal });
  }

  async listOsCapabilities(signal?: AbortSignal): Promise<readonly OsCapabilityView[]> {
    return this.requestJson<readonly OsCapabilityView[]>('/v2/os/capabilities', { signal });
  }

  async listAgents(signal?: AbortSignal): Promise<readonly AgentView[]> {
    return this.requestJson<readonly AgentView[]>('/v2/agents', { signal });
  }

  async listAgentRuns(agentId: string, signal?: AbortSignal): Promise<readonly AgentRunView[]> {
    return this.requestJson<readonly AgentRunView[]>(`/v2/agents/${encodeURIComponent(agentId)}/runs`, { signal });
  }

  async listTools(signal?: AbortSignal): Promise<readonly ToolView[]> {
    return this.requestJson<readonly ToolView[]>('/v2/tools', { signal });
  }

  async listSkills(signal?: AbortSignal): Promise<readonly SkillView[]> {
    return this.requestJson<readonly SkillView[]>('/v2/skills', { signal });
  }

  async listWorkflows(signal?: AbortSignal): Promise<readonly WorkflowView[]> {
    return this.requestJson<readonly WorkflowView[]>('/v2/workflows', { signal });
  }

  async listWorkflowRuns(workflowId?: string, signal?: AbortSignal): Promise<readonly WorkflowRunView[]> {
    return this.requestJson<readonly WorkflowRunView[]>('/v2/workflow-runs', {
      signal,
      query: workflowId !== undefined ? { workflowId } : undefined,
    });
  }

  async listTasks(signal?: AbortSignal, filter?: { readonly status?: string; readonly milestoneId?: string }): Promise<readonly TaskView[]> {
    return this.requestJson<readonly TaskView[]>('/v2/tasks', {
      signal,
      query: filter,
    });
  }

  async validateTaskDependencies(signal?: AbortSignal): Promise<{ readonly ok: boolean; readonly cycles: readonly (readonly string[])[] }> {
    return this.requestJson<{ readonly ok: boolean; readonly cycles: readonly (readonly string[])[] }>('/v2/tasks/dependencies', { signal });
  }

  async listTaskEvents(signal?: AbortSignal): Promise<readonly TaskEventView[]> {
    return this.requestJson<readonly TaskEventView[]>('/v2/tasks/events', { signal });
  }

  async listConfigContributions(signal?: AbortSignal): Promise<readonly ConfigContributionView[]> {
    return this.requestJson<readonly ConfigContributionView[]>('/v2/config/contributions', { signal });
  }

  async listConfigFields(signal?: AbortSignal): Promise<readonly ConfigFieldView[]> {
    return this.requestJson<readonly ConfigFieldView[]>('/v2/config/fields', { signal });
  }

  async listConfigTransactions(signal?: AbortSignal): Promise<readonly ConfigTransactionView[]> {
    return this.requestJson<readonly ConfigTransactionView[]>('/v2/config/transactions', { signal });
  }

  async analyzeConfigImpact(changes: readonly { readonly key: string; readonly from: unknown; readonly to: unknown }[], signal?: AbortSignal): Promise<ConfigImpactView> {
    return this.requestJson<ConfigImpactView>('/v2/config/impact', {
      method: 'POST',
      signal,
      body: { changes },
    });
  }

  async listDiagnosticChecks(signal?: AbortSignal): Promise<readonly DiagnosticCheckView[]> {
    return this.requestJson<readonly DiagnosticCheckView[]>('/v2/diagnostics/checks', { signal });
  }

  async listDiagnosticRuns(signal?: AbortSignal): Promise<readonly DiagnosticRunView[]> {
    return this.requestJson<readonly DiagnosticRunView[]>('/v2/diagnostics/runs', { signal });
  }

  async listLogRecords(signal?: AbortSignal, filter?: {
    readonly level?: string | readonly string[];
    readonly sourceId?: string;
    readonly sourceType?: string;
    readonly correlationId?: string;
    readonly workflowId?: string;
    readonly agentId?: string;
    readonly messageContains?: string;
    readonly since?: string;
    readonly until?: string;
    readonly limit?: number;
  }): Promise<readonly LogRecordView[]> {
    return this.requestJson<readonly LogRecordView[]>('/v2/logs', {
      signal,
      query: filter,
    });
  }

  async listLogTail(limit = 50, signal?: AbortSignal): Promise<readonly LogRecordView[]> {
    return this.requestJson<readonly LogRecordView[]>('/v2/logs/tail', {
      signal,
      query: { limit },
    });
  }

  async getLogStats(signal?: AbortSignal): Promise<LogStatsView> {
    return this.requestJson<LogStatsView>('/v2/logs/stats', { signal });
  }

  async listLogSources(signal?: AbortSignal): Promise<readonly string[]> {
    return this.requestJson<readonly string[]>('/v2/logs/sources', { signal });
  }

  async listUsers(signal?: AbortSignal): Promise<readonly UserView[]> {
    return this.requestJson<readonly UserView[]>('/v2/users', { signal });
  }

  async listPermissions(signal?: AbortSignal): Promise<readonly PermissionDefinitionView[]> {
    return this.requestJson<readonly PermissionDefinitionView[]>('/v2/permissions', { signal });
  }

  async listPermissionRoles(signal?: AbortSignal): Promise<readonly PermissionRoleView[]> {
    return this.requestJson<readonly PermissionRoleView[]>('/v2/permissions/roles', { signal });
  }

  async listTemporaryGrants(signal?: AbortSignal): Promise<readonly TemporaryGrantView[]> {
    return this.requestJson<readonly TemporaryGrantView[]>('/v2/permissions/temporary', { signal });
  }

  async evaluatePermission(
    permission: string,
    principalId: string,
    signal?: AbortSignal,
    scope?: string,
    resource?: string,
  ): Promise<PermissionDecisionView> {
    return this.requestJson<PermissionDecisionView>('/v2/permissions/evaluate', {
      method: 'POST',
      signal,
      body: { permission, principalId, ...(scope !== undefined ? { scope } : {}), ...(resource !== undefined ? { resource } : {}) },
    });
  }

  async getAuthMe(signal?: AbortSignal): Promise<AuthIdentityView> {
    return this.requestJson<AuthIdentityView>('/v2/auth/me', { signal });
  }

  async listAuthSessions(signal?: AbortSignal): Promise<readonly AuthSessionView[]> {
    return this.requestJson<readonly AuthSessionView[]>('/v2/auth/sessions', { signal });
  }

  async checkAuthPermission(permission: string, resource?: string, signal?: AbortSignal): Promise<AuthCheckView> {
    return this.requestJson<AuthCheckView>('/v2/auth/check', {
      method: 'POST',
      signal,
      body: { permission, ...(resource !== undefined ? { resource } : {}) },
    });
  }

  async listMarketplaceContributions(signal?: AbortSignal): Promise<readonly MarketplaceContributionView[]> {
    return this.requestJson<readonly MarketplaceContributionView[]>('/v2/marketplace-v2/contributions', { signal });
  }

  async listMarketplaceBundles(signal?: AbortSignal): Promise<readonly MarketplaceBundleView[]> {
    return this.requestJson<readonly MarketplaceBundleView[]>('/v2/marketplace-v2/bundles', { signal });
  }

  async listMarketplaceDistributions(signal?: AbortSignal): Promise<readonly MarketplaceDistributionView[]> {
    return this.requestJson<readonly MarketplaceDistributionView[]>('/v2/marketplace-v2/distributions', { signal });
  }

  async listMarketplacePublished(signal?: AbortSignal): Promise<readonly MarketplacePublishedView[]> {
    return this.requestJson<readonly MarketplacePublishedView[]>('/v2/marketplace-v2/published', { signal });
  }

  async listThemes(signal?: AbortSignal): Promise<readonly ThemeView[]> {
    return this.requestJson<readonly ThemeView[]>('/v2/themes', { signal });
  }

  async listTemplates(signal?: AbortSignal): Promise<readonly TemplateView[]> {
    return this.requestJson<readonly TemplateView[]>('/v2/templates', { signal });
  }

  async listTemplateKinds(signal?: AbortSignal): Promise<readonly string[]> {
    return this.requestJson<readonly string[]>('/v2/templates/kinds', { signal });
  }

  async listAiProviders(signal?: AbortSignal): Promise<readonly AiProviderView[]> {
    return this.requestJson<readonly AiProviderView[]>('/v2/ai/providers', { signal });
  }

  async listAiModels(
    signal?: AbortSignal,
    filter?: {
      readonly provider?: string;
      readonly reasoning?: string;
      readonly tools?: string;
      readonly structuredOutput?: string;
      readonly input?: string;
      readonly minContext?: number;
    },
  ): Promise<readonly AiModelView[]> {
    return this.requestJson<readonly AiModelView[]>('/v2/ai/models', {
      signal,
      query: filter,
    });
  }

  async listAiUsage(signal?: AbortSignal, consumerId?: string): Promise<readonly AiUsageView[]> {
    return this.requestJson<readonly AiUsageView[]>('/v2/ai/usage', {
      signal,
      query: consumerId !== undefined ? { consumerId } : undefined,
    });
  }

  async listAiCapabilities(signal?: AbortSignal): Promise<readonly AiCapabilityView[]> {
    return this.requestJson<readonly AiCapabilityView[]>('/v2/ai/capabilities', { signal });
  }

  async listDatabaseDefinitions(signal?: AbortSignal): Promise<readonly DatabaseDefinitionView[]> {
    return this.requestJson<readonly DatabaseDefinitionView[]>('/v2/database/definitions', { signal });
  }

  async listDatabaseConnections(signal?: AbortSignal): Promise<readonly DatabaseConnectionView[]> {
    return this.requestJson<readonly DatabaseConnectionView[]>('/v2/database/connections', { signal });
  }

  async listFileWorkspaces(signal?: AbortSignal): Promise<readonly FileWorkspaceView[]> {
    return this.requestJson<readonly FileWorkspaceView[]>('/v2/files/workspaces', { signal });
  }

  async listFileEvents(signal?: AbortSignal): Promise<readonly FileEventView[]> {
    return this.requestJson<readonly FileEventView[]>('/v2/files/events', { signal });
  }

  async listContextProviders(signal?: AbortSignal): Promise<readonly ContextProviderView[]> {
    return this.requestJson<readonly ContextProviderView[]>('/v2/context/providers', { signal });
  }

  async listContextSnapshots(signal?: AbortSignal): Promise<readonly ContextSnapshotView[]> {
    return this.requestJson<readonly ContextSnapshotView[]>('/v2/context/snapshots', { signal });
  }

  async listBuilderKinds(signal?: AbortSignal): Promise<readonly BuilderKindView[]> {
    return this.requestJson<readonly BuilderKindView[]>('/v2/builders/kinds', { signal });
  }

  async listBuilderDefinitions(signal?: AbortSignal): Promise<readonly BuilderDefinitionView[]> {
    return this.requestJson<readonly BuilderDefinitionView[]>('/v2/builders/definitions', { signal });
  }

  async listBuilderSessions(signal?: AbortSignal): Promise<readonly BuilderSessionView[]> {
    return this.requestJson<readonly BuilderSessionView[]>('/v2/builders/sessions', { signal });
  }

  async listGenerators(signal?: AbortSignal): Promise<readonly GeneratorDescriptorView[]> {
    return this.requestJson<readonly GeneratorDescriptorView[]>('/v2/generator/generators', { signal });
  }

  async listGeneratorCapabilities(signal?: AbortSignal): Promise<readonly string[]> {
    return this.requestJson<readonly string[]>('/v2/generator/capabilities', { signal });
  }

  async listComponents(signal?: AbortSignal): Promise<readonly ComponentView[]> {
    return this.requestJson<readonly ComponentView[]>('/v2/components', { signal });
  }

  async listComponentCategories(signal?: AbortSignal): Promise<readonly ComponentCategoryView[]> {
    return this.requestJson<readonly ComponentCategoryView[]>('/v2/components/categories', { signal });
  }

  async listComponentTrees(signal?: AbortSignal): Promise<readonly ComponentTreeView[]> {
    return this.requestJson<readonly ComponentTreeView[]>('/v2/components/trees', { signal });
  }

  async listBrowserRuntimes(signal?: AbortSignal): Promise<readonly BrowserRuntimeView[]> {
    return this.requestJson<readonly BrowserRuntimeView[]>('/v2/browser/runtimes', { signal });
  }

  async listBrowserProfiles(signal?: AbortSignal): Promise<readonly BrowserProfileView[]> {
    return this.requestJson<readonly BrowserProfileView[]>('/v2/browser/profiles', { signal });
  }

  async listBrowserSessions(signal?: AbortSignal): Promise<readonly BrowserSessionView[]> {
    return this.requestJson<readonly BrowserSessionView[]>('/v2/browser/sessions', { signal });
  }

  async listBrowserEvidence(signal?: AbortSignal): Promise<readonly BrowserEvidenceView[]> {
    return this.requestJson<readonly BrowserEvidenceView[]>('/v2/browser/evidence', { signal });
  }

  async listTestRunners(signal?: AbortSignal): Promise<readonly TestRunnerView[]> {
    return this.requestJson<readonly TestRunnerView[]>('/v2/test/runners', { signal });
  }

  async listTestSuites(signal?: AbortSignal): Promise<readonly TestSuiteView[]> {
    return this.requestJson<readonly TestSuiteView[]>('/v2/test/suites', { signal });
  }

  async listTestPlans(signal?: AbortSignal): Promise<readonly TestPlanView[]> {
    return this.requestJson<readonly TestPlanView[]>('/v2/test/plans', { signal });
  }

  async listTestRuns(signal?: AbortSignal): Promise<readonly TestRunView[]> {
    return this.requestJson<readonly TestRunView[]>('/v2/test/runs', { signal });
  }

  async listPages(signal?: AbortSignal): Promise<readonly PageDefinitionView[]> {
    return this.requestJson<readonly PageDefinitionView[]>('/v2/pages', { signal });
  }

  async listDashboards(signal?: AbortSignal): Promise<readonly DashboardView[]> {
    return this.requestJson<readonly DashboardView[]>('/v2/dashboards', { signal });
  }

  async listDashboardWidgets(signal?: AbortSignal): Promise<readonly DashboardWidgetDefinitionView[]> {
    return this.requestJson<readonly DashboardWidgetDefinitionView[]>('/v2/dashboard/widgets', { signal });
  }

  async getDashboardProjection(dashboardId: string, signal?: AbortSignal): Promise<readonly DashboardProjectionView[]> {
    return this.requestJson<readonly DashboardProjectionView[]>(`/v2/dashboards/${encodeURIComponent(dashboardId)}/projection`, { signal });
  }

  async listApplications(signal?: AbortSignal): Promise<readonly ApplicationView[]> {
    return this.requestJson<readonly ApplicationView[]>('/v2/applications', { signal });
  }

  async getApplicationModel(id: string, signal?: AbortSignal): Promise<ApplicationModelView> {
    return this.requestJson<ApplicationModelView>(`/v2/applications/${encodeURIComponent(id)}/model`, { signal });
  }
}
