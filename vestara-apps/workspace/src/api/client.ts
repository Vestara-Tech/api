import type {
  ApplicationView,
  ComponentCategoryView,
  ComponentView,
  ConfigContributionView,
  ConfigFieldView,
  ConfigSchemaView,
  DashboardView,
  FileWorkspaceView,
  FileEventView,
  GeneratorDescriptorView,
  PageDefinitionView,
  ResolvedConfigValueView,
  TemplateView,
  ThemeView,
  WorkspaceCapabilityView,
} from './contracts.js';

export class WorkspaceApiClient {
  constructor(private readonly apiBaseUrl = '/api') {}

  private requestOptions(signal?: AbortSignal): RequestInit {
    return signal === undefined ? {} : { signal };
  }

  private async requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body !== undefined) headers.set('Content-Type', 'application/json');

    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  async getEnabledCapabilities(signal?: AbortSignal): Promise<readonly string[]> {
    return this.requestJson<readonly string[]>('/v2/capabilities/enabled', this.requestOptions(signal));
  }

  async listCapabilities(signal?: AbortSignal): Promise<readonly WorkspaceCapabilityView[]> {
    return this.requestJson<readonly WorkspaceCapabilityView[]>('/v2/capabilities', this.requestOptions(signal));
  }

  async listComponents(signal?: AbortSignal): Promise<readonly ComponentView[]> {
    return this.requestJson<readonly ComponentView[]>('/v2/components', this.requestOptions(signal));
  }

  async listComponentCategories(signal?: AbortSignal): Promise<readonly ComponentCategoryView[]> {
    return this.requestJson<readonly ComponentCategoryView[]>('/v2/components/categories', this.requestOptions(signal));
  }

  async listTemplates(signal?: AbortSignal): Promise<readonly TemplateView[]> {
    return this.requestJson<readonly TemplateView[]>('/v2/templates', this.requestOptions(signal));
  }

  async listTemplateKinds(signal?: AbortSignal): Promise<readonly string[]> {
    return this.requestJson<readonly string[]>('/v2/templates/kinds', this.requestOptions(signal));
  }

  async listPages(signal?: AbortSignal): Promise<readonly PageDefinitionView[]> {
    return this.requestJson<readonly PageDefinitionView[]>('/v2/pages', this.requestOptions(signal));
  }

  async listDashboards(signal?: AbortSignal): Promise<readonly DashboardView[]> {
    return this.requestJson<readonly DashboardView[]>('/v2/dashboards', this.requestOptions(signal));
  }

  async listApplications(signal?: AbortSignal): Promise<readonly ApplicationView[]> {
    return this.requestJson<readonly ApplicationView[]>('/v2/applications', this.requestOptions(signal));
  }

  async listThemes(signal?: AbortSignal): Promise<readonly ThemeView[]> {
    return this.requestJson<readonly ThemeView[]>('/v2/themes', this.requestOptions(signal));
  }

  async listGenerators(signal?: AbortSignal): Promise<readonly GeneratorDescriptorView[]> {
    return this.requestJson<readonly GeneratorDescriptorView[]>('/v2/generator/generators', this.requestOptions(signal));
  }

  async listGeneratorCapabilities(signal?: AbortSignal): Promise<readonly string[]> {
    return this.requestJson<readonly string[]>('/v2/generator/capabilities', this.requestOptions(signal));
  }

  async listFileWorkspaces(signal?: AbortSignal): Promise<readonly FileWorkspaceView[]> {
    return this.requestJson<readonly FileWorkspaceView[]>('/v2/files/workspaces', this.requestOptions(signal));
  }

  async listFileEvents(signal?: AbortSignal): Promise<readonly FileEventView[]> {
    return this.requestJson<readonly FileEventView[]>('/v2/files/events', this.requestOptions(signal));
  }

  async listConfigFields(signal?: AbortSignal): Promise<readonly ConfigFieldView[]> {
    return this.requestJson<readonly ConfigFieldView[]>('/v2/config/fields', this.requestOptions(signal));
  }

  async listConfigSchemas(signal?: AbortSignal): Promise<readonly ConfigSchemaView[]> {
    return this.requestJson<readonly ConfigSchemaView[]>('/v2/config/schemas', this.requestOptions(signal));
  }

  async listConfigContributions(signal?: AbortSignal): Promise<readonly ConfigContributionView[]> {
    return this.requestJson<readonly ConfigContributionView[]>('/v2/config/contributions', this.requestOptions(signal));
  }

  async listConfigResolved(signal?: AbortSignal): Promise<readonly ResolvedConfigValueView[]> {
    return this.requestJson<readonly ResolvedConfigValueView[]>('/v2/config/resolved', this.requestOptions(signal));
  }
}
