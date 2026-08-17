export interface CapabilityRegistrationView {
  readonly id: string;
  readonly namespace: string;
  readonly version: string;
  readonly permissions: readonly string[];
  readonly operations: readonly string[];
  readonly enabled: boolean;
}

export interface StartupServiceView {
  readonly serviceId: string;
  readonly readiness: string;
  readonly weight: number;
  readonly updatedAt: string;
  readonly detail?: string;
}

export interface StartupSnapshot {
  readonly state: {
    readonly status: string;
    readonly destination: string;
    readonly firstBoot: boolean;
    readonly authenticated: boolean;
    readonly sessionReady: boolean;
    readonly readyAt?: string;
    readonly failure?: {
      readonly stage: string;
      readonly message: string;
      readonly at: string;
    };
  };
  readonly progress: unknown;
  readonly services: readonly StartupServiceView[];
  readonly classification: unknown;
}

export interface SystemStatusView {
  readonly service: string;
  readonly apiVersion: string;
  readonly contractVersion: string;
  readonly uptimeMs: number;
  readonly startedAt: string;
  readonly capabilities: readonly string[];
}

export interface SystemSnapshotView {
  readonly identity: {
    readonly hostname: string;
  };
  readonly operatingSystem: {
    readonly id: string;
    readonly name: string;
    readonly version: string;
    readonly kernel: string;
    readonly architecture: string;
    readonly bootMode: string;
  };
  readonly firmware: {
    readonly mode: string;
  };
  readonly cpu: {
    readonly logicalCores: number;
    readonly status: string;
  };
  readonly memory: {
    readonly totalBytes: number;
    readonly status: string;
  };
  readonly storage: {
    readonly devices: readonly { readonly name: string; readonly sizeBytes: number }[];
    readonly totalBytes: number;
    readonly status: string;
  };
  readonly filesystems: {
    readonly filesystems: readonly unknown[];
    readonly status: string;
  };
  readonly network: {
    readonly interfaces: readonly { readonly name: string; readonly up: boolean }[];
    readonly status: string;
  };
  readonly graphics: {
    readonly devices: readonly unknown[];
    readonly status: string;
  };
  readonly devices: {
    readonly devices: readonly unknown[];
    readonly status: string;
  };
  readonly power: {
    readonly info: unknown;
    readonly status: string;
  };
  readonly thermal: {
    readonly info: unknown;
    readonly status: string;
  };
  readonly kernel: {
    readonly release: string;
    readonly modules: readonly { readonly name: string; readonly status: string }[];
    readonly status: string;
  };
  readonly boot: {
    readonly entries: readonly unknown[];
    readonly status: string;
  };
  readonly capturedAt: string;
}

export interface SystemServiceView {
  readonly name: string;
  readonly status: string;
  readonly description?: string;
  readonly enabled?: boolean;
  readonly pid?: number;
}

export interface SystemProcessView {
  readonly pid: number;
  readonly name: string;
  readonly memoryBytes?: number;
}

export interface SystemKernelView {
  readonly release: string;
  readonly modules: readonly { readonly name: string; readonly status: string }[];
  readonly status: string;
}

export interface SystemStorageView {
  readonly disks: readonly { readonly name: string; readonly sizeBytes: number; readonly type?: string }[];
  readonly mounts: readonly { readonly device: string; readonly mountPoint: string; readonly filesystem: string; readonly readOnly: boolean }[];
}

export interface SystemOperationView {
  readonly id: string;
  readonly kind: string;
  readonly risk: string;
  readonly target: string;
  readonly status: string;
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly approvedAt?: string;
  readonly completedAt?: string;
  readonly error?: string;
  readonly approvedBy?: string;
}

export interface OsProfileView {
  readonly identity: {
    readonly hostname: string;
    readonly distributionId: string;
    readonly kernelRelease: string;
    readonly architecture: string;
  };
  readonly distribution: {
    readonly id: string;
    readonly packageManager: string;
  };
  readonly kernel: {
    readonly release: string;
    readonly parameters: readonly string[];
    readonly updatePolicy: string;
  };
  readonly packages: {
    readonly packages: readonly { readonly name: string; readonly state: string }[];
    readonly repositories: readonly unknown[];
  };
  readonly services: {
    readonly services: readonly unknown[];
  };
  readonly users: readonly unknown[];
  readonly startup: {
    readonly target: string;
    readonly timeoutSeconds: number;
    readonly failurePolicy: string;
  };
  readonly login: {
    readonly provider: string;
    readonly allowAutoLogin: boolean;
  };
  readonly desktop: {
    readonly environment: string;
    readonly theme: string;
  };
  readonly network: {
    readonly hostname: string;
    readonly interfaces: readonly unknown[];
  };
  readonly locale: {
    readonly language: string;
    readonly locale: string;
    readonly timezone: string;
  };
  readonly security: {
    readonly lockdown: string;
  };
  readonly updates: {
    readonly channel: string;
    readonly automatic: boolean;
    readonly rebootPolicy: string;
  };
  readonly recovery: {
    readonly enabled: boolean;
  };
}

export interface OsCurrentView {
  readonly profile: OsProfileView;
  readonly lifecycle: {
    readonly state: string;
    readonly since: string;
  };
  readonly capturedAt: string;
}

export interface OsDesiredView {
  readonly profile: OsProfileView;
  readonly revision: number;
  readonly updatedAt: string;
}

export interface OsStateView {
  readonly current: {
    readonly profile: OsProfileView;
    readonly capturedAt: string;
  };
  readonly desired: {
    readonly profile: OsProfileView;
    readonly revision: number;
    readonly updatedAt: string;
  };
  readonly driftCount: number;
}

export interface OsDiffView {
  readonly entries: readonly {
    readonly category: string;
    readonly key: string;
    readonly from?: unknown;
    readonly to?: unknown;
  }[];
  readonly driftCount: number;
  readonly generatedAt: string;
}

export interface OsPlanView {
  readonly planId: string;
  readonly changes: readonly {
    readonly id: string;
    readonly kind: string;
    readonly category: string;
    readonly target: string;
    readonly from?: unknown;
    readonly to?: unknown;
    readonly risk: string;
    readonly requiresReboot: boolean;
    readonly requiresApproval: boolean;
    readonly requiresSystemCapability?: string;
  }[];
  readonly order: readonly string[];
  readonly totalRisk: string;
  readonly requiresApproval: boolean;
  readonly requiresReboot: boolean;
  readonly planHash: string;
  readonly generatedAt: string;
}

export interface OsCapabilityView {
  readonly id: string;
  readonly kind: string;
  readonly risk: string;
  readonly requiresApproval: boolean;
  readonly description: string;
}

export interface AgentView {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly role: string;
  readonly tools: readonly { readonly id: string }[];
  readonly skills: readonly { readonly id: string }[];
  readonly permissions: readonly string[];
}

export interface AgentRunView {
  readonly id: string;
  readonly agentId: string;
  readonly status: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly result?: string;
  readonly error?: string;
}

export interface ToolView {
  readonly id: string;
  readonly version: string;
  readonly description: string;
  readonly capabilities: readonly string[];
  readonly risk: string;
}

export interface SkillView {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly description: string;
  readonly requiredCapabilities: readonly string[];
  readonly compatibleRoles?: readonly string[];
}

export interface WorkflowView {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly inputs: readonly {
    readonly name: string;
    readonly type: string;
    readonly required: boolean;
  }[];
  readonly steps: readonly {
    readonly id: string;
    readonly kind: string;
    readonly name: string;
    readonly dependsOn?: readonly string[];
  }[];
  readonly status: string;
  readonly revision: number;
}

export interface WorkflowRunView {
  readonly id: string;
  readonly workflowId: string;
  readonly version: string;
  readonly status: string;
  readonly steps: readonly {
    readonly stepId: string;
    readonly name: string;
    readonly kind: string;
    readonly status: string;
    readonly attempts: number;
    readonly error?: string;
  }[];
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly error?: string;
  readonly waitingOnStep?: string;
}

export interface TaskView {
  readonly id: string;
  readonly title: string;
  readonly type: string;
  readonly status: string;
  readonly priority: string;
  readonly milestoneId?: string;
  readonly parentTaskId?: string;
  readonly dependencies: readonly { readonly taskId: string; readonly kind: string }[];
  readonly assignee?: string;
  readonly acceptanceCriteria: readonly { readonly id: string; readonly description: string; readonly satisfied: boolean }[];
  readonly revision: number;
}

export interface TaskResultView {
  readonly taskId: string;
  readonly outcome: string;
  readonly summary: string;
  readonly evidenceIds: readonly string[];
  readonly completedAt: string;
}

export interface TaskEventView {
  readonly type: string;
  readonly taskId: string;
  readonly at: string;
}

export interface ConfigFieldView {
  readonly key: string;
  readonly title: string;
  readonly type: string;
  readonly required?: boolean;
  readonly secret?: boolean;
  readonly reloadBehavior: string;
  readonly risk: string;
}

export interface ConfigContributionView {
  readonly packageId: string;
  readonly namespace: string;
  readonly version: string;
  readonly fields: readonly ConfigFieldView[];
}

export interface ConfigTransactionView {
  readonly id: string;
  readonly scope: {
    readonly type: string;
  };
  readonly status: string;
  readonly createdAt: string;
}

export interface ConfigImpactView {
  readonly affectedModules: readonly string[];
  readonly affectedServices: readonly string[];
  readonly requiredRestarts: readonly string[];
  readonly requiresRegeneration: readonly string[];
  readonly requiresReboot: boolean;
  readonly risk: string;
  readonly summary: string;
}

export interface DiagnosticCheckView {
  readonly checkId: string;
  readonly name: string;
  readonly category: string;
  readonly risk: string;
  readonly moduleId: string;
}

export interface DiagnosticRunView {
  readonly id: string;
  readonly scope: string;
  readonly target?: string;
  readonly status: string;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly counts: {
    readonly healthy: number;
    readonly degraded: number;
    readonly failed: number;
  };
  readonly findings: readonly {
    readonly id: string;
    readonly checkId: string;
    readonly severity: string;
    readonly status: string;
    readonly message: string;
    readonly at: string;
  }[];
}

export interface LogRecordView {
  readonly id: string;
  readonly timestamp: string;
  readonly level: string;
  readonly message: string;
  readonly source: {
    readonly type: string;
    readonly id: string;
  };
  readonly correlationId?: string;
  readonly workflowId?: string;
  readonly agentId?: string;
  readonly operationId?: string;
  readonly attributes: Record<string, unknown>;
}

export interface LogStatsView {
  readonly total: number;
  readonly byLevel: Record<string, number>;
  readonly bySource: Record<string, number>;
}

export interface UserView {
  readonly id: string;
  readonly identityId: string;
  readonly username: string;
  readonly status: string;
  readonly profile: {
    readonly displayName: string;
    readonly avatar?: string;
    readonly locale?: string;
    readonly timezone?: string;
    readonly jobTitle?: string;
    readonly organization?: string;
  };
  readonly preferences: Record<string, unknown>;
  readonly settings: {
    readonly emailVerified: boolean;
    readonly email?: string;
    readonly twoFactorEnabled: boolean;
  };
  readonly memberships: readonly {
    readonly id: string;
    readonly organizationId: string;
    readonly workspaceId?: string;
    readonly roleIds: readonly string[];
  }[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt?: string;
}

export interface AuthIdentityView {
  readonly id: string;
  readonly principalKind: string;
  readonly status: string;
  readonly profile: {
    readonly displayName?: string;
    readonly primaryEmail?: string;
    readonly pictureUrl?: string;
  };
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
}

export interface AuthSessionView {
  readonly id: string;
  readonly identityId: string;
  readonly principalKind: string;
  readonly authenticationMethod: string;
  readonly authenticationTime: string;
  readonly assuranceLevel: string;
  readonly device?: string;
  readonly expiresAt: string;
  readonly lastSeenAt: string;
  readonly revokedAt?: string;
}

export interface AuthCheckView {
  readonly allowed: boolean;
  readonly requiredApproval?: boolean;
  readonly reason?: string;
}

export interface PermissionDefinitionView {
  readonly id: string;
  readonly resource: string;
  readonly action: string;
  readonly risk: 'low' | 'medium' | 'high' | 'critical';
  readonly description?: string;
}

export interface PermissionRoleView {
  readonly id: string;
  readonly name: string;
  readonly permissions: readonly string[];
}

export interface TemporaryGrantView {
  readonly id: string;
  readonly principalId: string;
  readonly permission: string;
  readonly reason: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly uses: number;
}

export interface PermissionDecisionView {
  readonly effect: 'allow' | 'deny' | 'approval-required' | 'constrained';
  readonly permission: string;
  readonly principalId: string;
  readonly reason: string;
  readonly matchedPolicies: readonly string[];
  readonly risk: string;
}

export interface MarketplaceContributionView {
  readonly packageId: string;
  readonly version: string;
  readonly manifest: {
    readonly provides: readonly {
      readonly kind: string;
      readonly id: string;
      readonly name: string;
      readonly version?: string;
      readonly description?: string;
    }[];
    readonly requires: readonly {
      readonly module: string;
      readonly range?: string;
      readonly capability?: string;
    }[];
    readonly optional: readonly {
      readonly module: string;
      readonly range?: string;
      readonly capability?: string;
    }[];
  };
}

export interface MarketplaceBundleView {
  readonly bundleId: string;
  readonly name: string;
  readonly description?: string;
  readonly packages: readonly { readonly packageId: string; readonly versionRange?: string; readonly required: boolean }[];
  readonly recommended: readonly { readonly packageId: string; readonly versionRange?: string }[];
  readonly optional: readonly { readonly packageId: string; readonly versionRange?: string }[];
  readonly ai?: readonly string[];
  readonly metadata: Record<string, unknown>;
}

export interface MarketplaceDistributionView {
  readonly distributionId: string;
  readonly name: string;
  readonly description?: string;
  readonly bundles: readonly { readonly bundleId: string; readonly required: boolean }[];
  readonly packages: readonly { readonly packageId: string; readonly required: boolean; readonly channel?: string }[];
  readonly channel: string;
  readonly curatedBy: string;
  readonly metadata: Record<string, unknown>;
}

export interface MarketplacePublishedView {
  readonly packageId: string;
  readonly version: string;
  readonly publisherId: string;
  readonly trustLevel: string;
  readonly channel: string;
  readonly signature: string;
  readonly publishedAt: string;
}

export interface ThemeView {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly mode: string;
  readonly tokens: Record<string, string | undefined>;
  readonly typography: {
    readonly fontFamily: string;
    readonly fontSizeScale: number;
    readonly baseSizePx: number;
    readonly headingWeight: number;
    readonly bodyWeight: number;
    readonly lineHeight: number;
  };
  readonly spacing: {
    readonly scale: readonly number[];
    readonly basePx: number;
  };
  readonly radius: {
    readonly small: number;
    readonly medium: number;
    readonly large: number;
    readonly full: number;
  };
  readonly elevation: {
    readonly levels: readonly string[];
  };
  readonly motion: {
    readonly durationFastMs: number;
    readonly durationMediumMs: number;
    readonly durationSlowMs: number;
    readonly easing: string;
  };
  readonly components: Record<string, unknown>;
  readonly assets: {
    readonly logo?: string;
    readonly wallpaper?: string;
    readonly splash?: string;
  };
  readonly metadata: {
    readonly author?: string;
    readonly description?: string;
    readonly tags: readonly string[];
    readonly mode: string;
  };
}

export interface ThemeSummaryView extends ThemeView {}

export interface TemplateParameterView {
  readonly name: string;
  readonly type: string;
  readonly required?: boolean;
  readonly defaultValue?: unknown;
  readonly enumValues?: readonly string[];
  readonly description?: string;
}

export interface TemplateView {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly kind: string;
  readonly description?: string;
  readonly tags: readonly string[];
  readonly parameters: readonly TemplateParameterView[];
  readonly definition: unknown;
  readonly recommendedThemeId?: string;
  readonly requiredCapabilities: readonly string[];
  readonly metadata: {
    readonly author?: string;
    readonly version: string;
    readonly license?: string;
    readonly tags: readonly string[];
  };
}

export interface AiProviderView {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly enabled: boolean;
  readonly priority: number;
  readonly apiEndpoint?: string;
}

export interface AiModelView {
  readonly id: string;
  readonly providerId: string;
  readonly name: string;
  readonly capabilities: {
    readonly reasoning: boolean;
    readonly tools: boolean;
    readonly structuredOutput: boolean;
    readonly functionCalling: boolean;
    readonly vision: boolean;
    readonly embeddings: boolean;
    readonly streaming: boolean;
  };
  readonly modalities: readonly string[];
  readonly contextWindow: number;
  readonly openWeight: boolean;
  readonly lifecycleStatus: string;
}

export interface AiUsageView {
  readonly requestId: string;
  readonly consumerId: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedTokens?: number;
  readonly estimatedCostUsd?: number;
  readonly latencyMs: number;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly fallbackCount: number;
}

export interface AiCapabilityView {
  readonly id: string;
  readonly name: string;
  readonly risk: string;
}

export interface DatabaseDefinitionView {
  readonly id: string;
  readonly name: string;
  readonly engine: string;
  readonly tables: readonly {
    readonly id: string;
    readonly name: string;
    readonly columns: readonly { readonly id: string; readonly name: string; readonly type: string }[];
  }[];
  readonly revision: number;
  readonly status: string;
}

export interface DatabaseConnectionView {
  readonly id: string;
  readonly name: string;
  readonly engine: string;
  readonly host: string;
  readonly database: string;
  readonly credentialRef: string;
  readonly status: string;
}

export interface FileWorkspaceView {
  readonly id: string;
  readonly name: string;
  readonly root: string;
  readonly providerId: string;
  readonly include?: readonly string[];
  readonly exclude?: readonly string[];
  readonly revision: number;
}

export interface FileEventView {
  readonly type: string;
  readonly at: string;
  readonly workspaceId?: string;
  readonly path?: string;
}

export interface ContextProviderView {
  readonly id: string;
  readonly kinds: readonly string[];
  readonly scope: string;
}

export interface ContextSnapshotView {
  readonly id: string;
  readonly bundleHash: string;
  readonly runId?: string;
  readonly agentId?: string;
  readonly workflowRunId?: string;
  readonly items: readonly {
    readonly itemId: string;
    readonly source: string;
    readonly scope: string;
    readonly tokenEstimate: number;
  }[];
  readonly createdAt: string;
}

export interface BuilderKindView {
  readonly kind: string;
  readonly moduleId: string;
  readonly version: string;
  readonly capabilities: readonly string[];
}

export interface BuilderDefinitionView {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly revision: number;
  readonly status: string;
  readonly updatedAt: string;
}

export interface BuilderSessionView {
  readonly sessionId: string;
  readonly draftId: string;
  readonly status: string;
  readonly startedAt: string;
}

export interface GeneratorDescriptorView {
  readonly id: string;
  readonly version: string;
  readonly capabilities: readonly string[];
  readonly requiresSecrets: boolean;
}

export interface ComponentView {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  readonly version: string;
  readonly category: string;
  readonly status: string;
  readonly capabilities: readonly string[];
  readonly slots: readonly { readonly name: string }[];
  readonly events: readonly { readonly name: string; readonly kind: string }[];
}

export interface ComponentCategoryView {
  readonly name: string;
  readonly count: number;
}

export interface ComponentTreeView {
  readonly id: string;
  readonly name: string;
}

export interface BrowserRuntimeView {
  readonly id: string;
  readonly deterministic: boolean;
  readonly agentic: boolean;
  readonly humanTakeover: boolean;
}

export interface BrowserProfileView {
  readonly id: string;
  readonly name: string;
  readonly runtime: string;
  readonly browser: string;
  readonly headless: boolean;
  readonly allowedDomains?: readonly string[];
  readonly blockedDomains?: readonly string[];
}

export interface BrowserSessionView {
  readonly id: string;
  readonly profileId: string;
  readonly runtime: string;
  readonly status: string;
  readonly tabs: readonly { readonly id: string; readonly url: string }[];
}

export interface BrowserEvidenceView {
  readonly sessionId: string;
  readonly action: string;
  readonly url: string;
  readonly runtime: string;
  readonly timestamp: string;
}

export interface TestRunnerView {
  readonly id: string;
  readonly capabilities: readonly string[];
}

export interface TestSuiteView {
  readonly id: string;
  readonly name: string;
  readonly tests: readonly {
    readonly id: string;
    readonly name: string;
    readonly type: string;
    readonly target: string;
    readonly runnerId: string;
    readonly requirements: readonly { readonly id: string; readonly description: string; readonly required: boolean }[];
    readonly parameters: Record<string, unknown>;
    readonly tags: readonly string[];
  }[];
}

export interface TestPlanView {
  readonly id: string;
  readonly name: string;
  readonly objective: string;
  readonly target: string;
  readonly suiteIds: readonly string[];
  readonly profileId: string;
}

export interface TestRunView {
  readonly id: string;
  readonly target: string;
  readonly status: string;
  readonly summary: {
    readonly total: number;
    readonly passed: number;
    readonly failed: number;
    readonly skipped: number;
  };
  readonly evidenceId?: string;
}

export interface PageDefinitionView {
  readonly id: string;
  readonly name: string;
  readonly route: string;
  readonly layout: {
    readonly type: string;
    readonly content: unknown;
  };
  readonly nodes: readonly unknown[];
  readonly dataSources: readonly unknown[];
  readonly actions: readonly unknown[];
  readonly permissions: readonly unknown[];
  readonly responsive: readonly unknown[];
  readonly metadata: {
    readonly title: string;
    readonly authRequired: boolean;
  };
  readonly revision: number;
  readonly updatedAt: string;
}

export interface DashboardWidgetInstanceView {
  readonly id: string;
  readonly type: string;
  readonly title?: string;
  readonly configuration: Record<string, unknown>;
  readonly placement: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly breakpoint: string;
  };
  readonly refreshIntervalSeconds?: number;
  readonly state: string;
  readonly lastUpdatedAt?: string;
  readonly error?: string;
}

export interface DashboardView {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly scope: string;
  readonly layout: {
    readonly columns: number;
    readonly rowHeight: number;
    readonly gap: number;
    readonly placements: readonly unknown[];
  };
  readonly widgets: readonly DashboardWidgetInstanceView[];
  readonly filters: readonly unknown[];
  readonly refreshPolicy: {
    readonly mode: string;
    readonly intervalSeconds?: number;
  };
  readonly ownerUserId?: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly publishedAt?: string;
}

export interface DashboardWidgetDefinitionView {
  readonly type: string;
  readonly moduleId: string;
  readonly title: string;
  readonly description?: string;
  readonly defaultSize: {
    readonly minWidth: number;
    readonly minHeight: number;
  };
  readonly dataSource: {
    readonly type: string;
    readonly moduleId?: string;
    readonly projection?: string;
  };
  readonly permissions: readonly string[];
  readonly configurable: boolean;
  readonly refreshIntervalSeconds?: number;
}

export interface DashboardProjectionView {
  readonly projectionId: string;
  readonly moduleId: string;
  readonly state: string;
  readonly data?: unknown;
  readonly error?: string;
  readonly durationMs?: number;
  readonly cachedAt?: string;
  readonly stale?: boolean;
}

export interface ApplicationPageView {
  readonly pageId: string;
  readonly path: string;
  readonly default?: boolean;
}

export interface ApplicationRouteView {
  readonly path: string;
  readonly pageId: string;
  readonly authRequired: boolean;
}

export interface ApplicationView {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly applicationType: string;
  readonly pages: readonly ApplicationPageView[];
  readonly routes: readonly ApplicationRouteView[];
  readonly navigation: readonly unknown[];
  readonly apis: readonly unknown[];
  readonly databases: readonly unknown[];
  readonly authentication: {
    readonly enabled: boolean;
    readonly provider: string;
  };
  readonly permissions: readonly unknown[];
  readonly workflows: readonly string[];
  readonly agents: readonly string[];
  readonly configuration: readonly string[];
  readonly integrations: readonly string[];
  readonly state: readonly unknown[];
  readonly lifecycle: string;
  readonly revision: number;
  readonly updatedAt: string;
}

export interface ApplicationModelView {
  readonly definition: ApplicationView;
  readonly pages: readonly (ApplicationPageView & {
    readonly name?: string;
    readonly route?: string;
    readonly revision?: number;
    readonly updatedAt?: string;
  })[];
  readonly lifecycle: string;
}
