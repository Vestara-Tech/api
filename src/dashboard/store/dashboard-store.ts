import type { DashboardDefinition } from '../domain/dashboard.js';

export interface DashboardStorePort {
  save(dashboard: DashboardDefinition): void;
  get(id: string): DashboardDefinition | undefined;
  list(): readonly DashboardDefinition[];
  remove(id: string): void;
}

export class InMemoryDashboardStore implements DashboardStorePort {
  private readonly dashboards = new Map<string, DashboardDefinition>();

  save(dashboard: DashboardDefinition): void {
    this.dashboards.set(dashboard.id, dashboard);
  }

  get(id: string): DashboardDefinition | undefined {
    return this.dashboards.get(id);
  }

  list(): readonly DashboardDefinition[] {
    return [...this.dashboards.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  remove(id: string): void {
    this.dashboards.delete(id);
  }
}
