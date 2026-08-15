/** APP-001..006 — Application Builder domain contracts. */

import type { PageDefinition } from '../../pagebuilder/domain/page-definition.js';

export type ApplicationType = 'web' | 'desktop' | 'mobile' | 'system' | 'dashboard';

export type ApplicationLifecycleState = 'draft' | 'planning' | 'building' | 'ready' | 'published' | 'archived';

export interface PageReference {
  readonly pageId: string;
  readonly path: string;
  readonly default?: boolean;
}

export interface RouteDefinition {
  readonly path: string;
  readonly pageId: string;
  readonly authRequired: boolean;
}

export interface NavigationItem {
  readonly id: string;
  readonly label: string;
  readonly route?: string;
  readonly icon?: string;
  readonly section?: string;
  readonly children?: readonly NavigationItem[];
}

export interface ApiBinding {
  readonly id: string;
  readonly operation: string;
  readonly method: string;
  readonly path: string;
}

export interface DatabaseBinding {
  readonly id: string;
  readonly database: string;
  readonly table: string;
  readonly operations: readonly string[];
  readonly governed: boolean;
}

export interface AuthenticationBinding {
  readonly enabled: boolean;
  readonly provider: 'vestara' | 'local' | 'oidc';
  readonly requireEmailVerification: boolean;
}

export interface AppPermissionBinding {
  readonly role: string;
  readonly permissions: readonly string[];
}

export interface AppState {
  readonly key: string;
  readonly initialValue?: unknown;
  readonly scope: 'application' | 'session';
}

export interface ApplicationDefinition {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly applicationType: ApplicationType;
  readonly pages: readonly PageReference[];
  readonly routes: readonly RouteDefinition[];
  readonly navigation: readonly NavigationItem[];
  readonly apis: readonly ApiBinding[];
  readonly databases: readonly DatabaseBinding[];
  readonly authentication: AuthenticationBinding;
  readonly permissions: readonly AppPermissionBinding[];
  readonly workflows: readonly string[];
  readonly agents: readonly string[];
  readonly configuration: readonly string[];
  readonly integrations: readonly string[];
  readonly state: readonly AppState[];
  readonly lifecycle: ApplicationLifecycleState;
  readonly revision: number;
  readonly updatedAt: string;
}

export interface ApplicationModel {
  readonly definition: ApplicationDefinition;
  readonly pages: readonly PageDefinition[];
  readonly lifecycle: ApplicationLifecycleState;
}

/** APP-002 — application lifecycle transitions. */
export const APPLICATION_LIFECYCLE_TRANSITIONS: Record<ApplicationLifecycleState, readonly ApplicationLifecycleState[]> = {
  draft: ['planning', 'archived'],
  planning: ['building', 'draft', 'archived'],
  building: ['ready', 'planning', 'draft'],
  ready: ['published', 'building', 'draft'],
  published: ['archived', 'draft'],
  archived: ['draft'],
};

export function canTransition(from: ApplicationLifecycleState, to: ApplicationLifecycleState): boolean {
  return APPLICATION_LIFECYCLE_TRANSITIONS[from].includes(to);
}

/** APP-001 — validations on the application definition. */
export function validateApplication(definition: ApplicationDefinition): readonly string[] {
  const errors: string[] = [];
  if (!definition.id) errors.push('Application id is required');
  if (!definition.name) errors.push('Application name is required');
  if (!definition.version) errors.push('Application version is required');

  const routePaths = new Set<string>();
  for (const route of definition.routes) {
    if (routePaths.has(route.path)) errors.push(`Duplicate route "${route.path}"`);
    routePaths.add(route.path);
    if (!definition.pages.some((p) => p.pageId === route.pageId)) {
      errors.push(`Route "${route.path}" references unknown page "${route.pageId}"`);
    }
  }

  const pageIds = new Set(definition.pages.map((p) => p.pageId));
  for (const navigation of definition.navigation) {
    if (navigation.route && !definition.routes.some((r) => r.path === navigation.route)) {
      errors.push(`Navigation "${navigation.label}" points to unknown route "${navigation.route}"`);
    }
  }
  void pageIds;

  if (definition.databases.some((d) => !d.governed && d.operations.includes('write'))) {
    errors.push('Direct database write bindings must be governed');
  }

  return errors;
}
