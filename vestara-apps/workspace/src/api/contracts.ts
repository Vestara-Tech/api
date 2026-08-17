export interface WorkspaceCapabilityView {
  readonly id: string;
  readonly namespace: string;
  readonly version: string;
  readonly enabled: boolean;
}

export interface ComponentCategoryView {
  readonly name: string;
  readonly count: number;
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
  readonly recommendedThemeId?: string;
  readonly requiredCapabilities: readonly string[];
  readonly metadata: {
    readonly author?: string;
    readonly version: string;
    readonly license?: string;
    readonly tags: readonly string[];
  };
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

export interface ApplicationView {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly applicationType: string;
  readonly pages: readonly { readonly pageId: string; readonly path: string; readonly default?: boolean }[];
  readonly routes: readonly { readonly path: string; readonly pageId: string; readonly authRequired: boolean }[];
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

export interface ThemeView {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly mode: string;
  readonly tokens: Readonly<Record<string, string | undefined>>;
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
  readonly components: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly assets: {
    readonly logo?: string;
    readonly icon?: string;
    readonly wallpaper?: string;
    readonly splash?: string;
    readonly fontFiles?: readonly string[];
  };
  readonly metadata: {
    readonly author?: string;
    readonly description?: string;
    readonly tags: readonly string[];
    readonly mode: string;
  };
}

export interface GeneratorDescriptorView {
  readonly id: string;
  readonly version: string;
  readonly capabilities: readonly string[];
  readonly requiresSecrets: boolean;
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

export interface ConfigFieldView {
  readonly key: string;
  readonly title: string;
  readonly type: string;
  readonly required?: boolean;
  readonly secret?: boolean;
  readonly reloadBehavior: string;
  readonly risk: string;
}

export interface ConfigSchemaView {
  readonly namespace: string;
  readonly version: string;
  readonly scope: readonly string[];
  readonly secretFields?: readonly string[];
}

export interface ConfigContributionView {
  readonly packageId: string;
  readonly namespace: string;
  readonly version: string;
  readonly fields: readonly ConfigFieldView[];
}

export interface ResolvedConfigValueView {
  readonly key: string;
  readonly value: unknown;
  readonly scope: string;
  readonly source: string;
  readonly secret: boolean;
}

export interface FileEventView {
  readonly type: string;
  readonly at: string;
  readonly workspaceId?: string;
  readonly path?: string;
}
