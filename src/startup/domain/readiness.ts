export type ServiceReadiness = 'not-started' | 'starting' | 'ready' | 'degraded' | 'failed';

export interface ServiceReadinessState {
  readonly serviceId: string;
  readonly readiness: ServiceReadiness;
  readonly weight: number;
  readonly updatedAt: string;
  readonly detail?: string;
}

export type ServiceCategory =
  | 'system'
  | 'storage'
  | 'database'
  | 'api'
  | 'authentication'
  | 'configuration'
  | 'integrations'
  | 'agents'
  | 'workspace';

export interface StartupServiceDefinition {
  readonly id: string;
  readonly name: string;
  readonly category: ServiceCategory;
  readonly weight: number;
  readonly required: boolean;
  readonly dependsOn?: readonly string[];
}

/**
 * DESK-003 — Service readiness registry. Tracks each startup service's
 * readiness so the UI can progressively expose detail without hiding problems.
 */
export class ServiceReadinessRegistry {
  private readonly services = new Map<string, ServiceReadinessState>();
  private readonly defs: readonly StartupServiceDefinition[];

  constructor(definitions: readonly StartupServiceDefinition[]) {
    this.defs = definitions;
    for (const def of definitions) {
      this.services.set(def.id, {
        serviceId: def.id,
        readiness: 'not-started',
        weight: def.weight,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  definitions(): readonly StartupServiceDefinition[] {
    return this.defs;
  }

  update(serviceId: string, readiness: ServiceReadiness, detail?: string): ServiceReadinessState | null {
    const current = this.services.get(serviceId);
    if (!current) return null;
    const next: ServiceReadinessState = {
      ...current,
      readiness,
      updatedAt: new Date().toISOString(),
      ...(detail !== undefined ? { detail } : {}),
    };
    this.services.set(serviceId, next);
    return next;
  }

  get(serviceId: string): ServiceReadinessState | null {
    return this.services.get(serviceId) ?? null;
  }

  all(): readonly ServiceReadinessState[] {
    return [...this.services.values()].sort((a, b) => a.serviceId.localeCompare(b.serviceId));
  }

  isReady(serviceId: string): boolean {
    return this.services.get(serviceId)?.readiness === 'ready';
  }
}
