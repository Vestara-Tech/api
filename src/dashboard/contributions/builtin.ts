import type { DashboardContribution } from '../domain/contribution.js';
/**
 * DASH-022..026 — First-party dashboard contributions. Modules contribute
 * widgets + projections; Dashboard core never hard-codes module knowledge.
 */

export interface SystemProjectionData {
  readonly cpu: number;
  readonly memoryUsedPercent: number;
  readonly storageUsedPercent: number;
  readonly uptimeSeconds: number;
  readonly servicesRunning: number;
  readonly healthy: boolean;
}

export interface TaskProjectionData {
  readonly open: number;
  readonly blocked: number;
  readonly overdue: number;
  readonly completedToday: number;
  readonly assignedToMe: number;
}

export interface AgentProjectionData {
  readonly active: number;
  readonly working: number;
  readonly runsToday: number;
  readonly tokensUsed: number;
}

export interface WorkflowProjectionData {
  readonly running: number;
  readonly needsReview: number;
  readonly failedToday: number;
  readonly completedToday: number;
}

export interface DiagnosticProjectionData {
  readonly healthyModules: number;
  readonly degradedModules: number;
  readonly problems: number;
  readonly systemHealthy: boolean;
}

export interface DatabaseProjectionData {
  readonly connections: number;
  readonly queryHealth: 'healthy' | 'degraded' | 'offline';
  readonly storageUsedBytes: number;
}

export interface NotificationProjectionData {
  readonly unread: number;
  readonly recent: readonly { id: string; message: string; at: string }[];
}

/** Dashboard system contribution with first-party projections. */
export function systemDashboardContribution(): DashboardContribution {
  return {
    moduleId: 'system',
    widgets: [
      {
        type: 'system.health',
        moduleId: 'system',
        title: 'System Health',
        sizes: [{ minWidth: 2, minHeight: 1 }, { minWidth: 4, minHeight: 2 }],
        defaultSize: { minWidth: 2, minHeight: 1 },
        dataSource: { type: 'projection', projection: 'system.overview', moduleId: 'system' },
        permissions: ['system.read'],
        configurable: true,
        refreshIntervalSeconds: 30,
      },
      {
        type: 'system.resources',
        moduleId: 'system',
        title: 'CPU / Memory / Storage',
        sizes: [{ minWidth: 2, minHeight: 1 }, { minWidth: 4, minHeight: 2 }],
        defaultSize: { minWidth: 2, minHeight: 1 },
        dataSource: { type: 'projection', projection: 'system.resources', moduleId: 'system' },
        permissions: ['system.read'],
        configurable: true,
        refreshIntervalSeconds: 30,
      },
    ],
    projections: [
      { id: 'system.overview', moduleId: 'system', title: 'System Overview', permissions: ['system.read'] },
      { id: 'system.resources', moduleId: 'system', title: 'System Resources', permissions: ['system.read'] },
    ],
  };
}

export function taskDashboardContribution(): DashboardContribution {
  return {
    moduleId: 'tasks',
    widgets: [
      {
        type: 'tasks.my-tasks',
        moduleId: 'tasks',
        title: 'My Tasks',
        sizes: [{ minWidth: 2, minHeight: 2 }, { minWidth: 4, minHeight: 3 }],
        defaultSize: { minWidth: 2, minHeight: 2 },
        dataSource: { type: 'projection', projection: 'tasks.overview', moduleId: 'tasks' },
        permissions: ['task.read'],
        configurable: true,
      },
    ],
    projections: [
      { id: 'tasks.overview', moduleId: 'tasks', title: 'Task Overview', permissions: ['task.read'] },
      { id: 'tasks.assigned', moduleId: 'tasks', title: 'Assigned Tasks', permissions: ['task.read'] },
    ],
  };
}

export function agentDashboardContribution(): DashboardContribution {
  return {
    moduleId: 'agent',
    widgets: [
      {
        type: 'agent.active',
        moduleId: 'agent',
        title: 'Active Agents',
        sizes: [{ minWidth: 2, minHeight: 1 }, { minWidth: 4, minHeight: 2 }],
        defaultSize: { minWidth: 2, minHeight: 1 },
        dataSource: { type: 'projection', projection: 'agent.overview', moduleId: 'agent' },
        permissions: ['agent.read'],
        configurable: true,
      },
      {
        type: 'agent.runs',
        moduleId: 'agent',
        title: 'Agent Runs',
        sizes: [{ minWidth: 2, minHeight: 2 }, { minWidth: 4, minHeight: 3 }],
        defaultSize: { minWidth: 2, minHeight: 2 },
        dataSource: { type: 'projection', projection: 'agent.runs', moduleId: 'agent' },
        permissions: ['agent.read'],
        configurable: false,
      },
    ],
    projections: [
      { id: 'agent.overview', moduleId: 'agent', title: 'Agent Overview', permissions: ['agent.read'] },
      { id: 'agent.runs', moduleId: 'agent', title: 'Agent Runs', permissions: ['agent.read'] },
    ],
  };
}

export function workflowDashboardContribution(): DashboardContribution {
  return {
    moduleId: 'workflow',
    widgets: [
      {
        type: 'workflow.activity',
        moduleId: 'workflow',
        title: 'Workflow Activity',
        sizes: [{ minWidth: 4, minHeight: 2 }, { minWidth: 6, minHeight: 3 }],
        defaultSize: { minWidth: 4, minHeight: 2 },
        dataSource: { type: 'projection', projection: 'workflow.overview', moduleId: 'workflow' },
        permissions: ['workflow.read'],
        configurable: true,
      },
    ],
    projections: [
      { id: 'workflow.overview', moduleId: 'workflow', title: 'Workflow Overview', permissions: ['workflow.read'] },
    ],
  };
}

export function diagnosticsDashboardContribution(): DashboardContribution {
  return {
    moduleId: 'diagnostics',
    widgets: [
      {
        type: 'diagnostics.health',
        moduleId: 'diagnostics',
        title: 'Module Health',
        sizes: [{ minWidth: 2, minHeight: 1 }, { minWidth: 4, minHeight: 2 }],
        defaultSize: { minWidth: 2, minHeight: 1 },
        dataSource: { type: 'projection', projection: 'diagnostics.overview', moduleId: 'diagnostics' },
        permissions: ['diagnostics.read'],
        configurable: true,
      },
      {
        type: 'diagnostics.problems',
        moduleId: 'diagnostics',
        title: 'Active Problems',
        sizes: [{ minWidth: 2, minHeight: 2 }, { minWidth: 4, minHeight: 3 }],
        defaultSize: { minWidth: 2, minHeight: 2 },
        dataSource: { type: 'projection', projection: 'diagnostics.problems', moduleId: 'diagnostics' },
        permissions: ['diagnostics.read'],
        configurable: false,
      },
    ],
    projections: [
      { id: 'diagnostics.overview', moduleId: 'diagnostics', title: 'Diagnostics Overview', permissions: ['diagnostics.read'] },
      { id: 'diagnostics.problems', moduleId: 'diagnostics', title: 'Active Problems', permissions: ['diagnostics.read'] },
    ],
  };
}

export function databaseDashboardContribution(): DashboardContribution {
  return {
    moduleId: 'database',
    widgets: [
      {
        type: 'database.health',
        moduleId: 'database',
        title: 'Database Health',
        sizes: [{ minWidth: 2, minHeight: 1 }, { minWidth: 4, minHeight: 2 }],
        defaultSize: { minWidth: 2, minHeight: 1 },
        dataSource: { type: 'projection', projection: 'database.overview', moduleId: 'database' },
        permissions: ['database.read'],
        configurable: true,
      },
    ],
    projections: [
      { id: 'database.overview', moduleId: 'database', title: 'Database Overview', permissions: ['database.read'] },
    ],
  };
}

export function notificationDashboardContribution(): DashboardContribution {
  return {
    moduleId: 'notification',
    widgets: [
      {
        type: 'notification.recent',
        moduleId: 'notification',
        title: 'Recent Activity',
        sizes: [{ minWidth: 4, minHeight: 2 }, { minWidth: 6, minHeight: 3 }],
        defaultSize: { minWidth: 4, minHeight: 2 },
        dataSource: { type: 'projection', projection: 'notification.recent', moduleId: 'notification' },
        permissions: [],
        configurable: false,
      },
    ],
    projections: [
      { id: 'notification.recent', moduleId: 'notification', title: 'Recent Notifications', permissions: [] },
    ],
  };
}

export function allDashboardContributions(): readonly DashboardContribution[] {
  return [
    systemDashboardContribution(),
    taskDashboardContribution(),
    agentDashboardContribution(),
    workflowDashboardContribution(),
    diagnosticsDashboardContribution(),
    databaseDashboardContribution(),
    notificationDashboardContribution(),
  ];
}
