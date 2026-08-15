import { describe, expect, it } from 'vitest';
import { TaskService, TaskStore, TaskLifecycle, TaskDependencyGraph, type Task } from '../../src/task/index.js';

function buildService() {
  const store = new TaskStore();
  const service = new TaskService({ store });
  return { store, service };
}

describe('TASK-002 lifecycle', () => {
  it('enforces the standard transition policy', () => {
    const lifecycle = TaskLifecycle.standard();
    expect(lifecycle.transition('draft', 'ready')).toBe('ready');
    expect(lifecycle.transition('in_progress', 'verification')).toBe('verification');
    expect(lifecycle.transition('verification', 'completed')).toBe('completed');
    expect(() => lifecycle.transition('draft', 'completed')).toThrow(/Invalid task transition/);
  });

  it('supports a manual-only policy', () => {
    const lifecycle = TaskLifecycle.manualOnly();
    expect(lifecycle.transition('ready', 'in_progress')).toBe('in_progress');
    expect(lifecycle.transition('in_progress', 'completed')).toBe('completed');
    expect(() => lifecycle.transition('in_progress', 'verification')).toThrow(/Invalid task transition/);
  });
});

describe('TASK-004 dependency graph', () => {
  it('detects cycles', () => {
    const tasks: Task[] = [
      { id: 'A', title: 'A', type: 'implementation', status: 'ready', priority: 'medium', dependencies: [{ taskId: 'B', kind: 'requires' }], acceptanceCriteria: [], verificationRequirements: [], evidenceRequirements: [], labels: [], metadata: {}, revision: 0 },
      { id: 'B', title: 'B', type: 'implementation', status: 'ready', priority: 'medium', dependencies: [{ taskId: 'C', kind: 'requires' }], acceptanceCriteria: [], verificationRequirements: [], evidenceRequirements: [], labels: [], metadata: {}, revision: 0 },
      { id: 'C', title: 'C', type: 'implementation', status: 'ready', priority: 'medium', dependencies: [{ taskId: 'A', kind: 'requires' }], acceptanceCriteria: [], verificationRequirements: [], evidenceRequirements: [], labels: [], metadata: {}, revision: 0 },
    ];
    const graph = new TaskDependencyGraph(tasks);
    const result = graph.validate();
    expect(result.ok).toBe(false);
    expect(result.cycles.length).toBeGreaterThan(0);
  });

  it('computes the ready set from completed prerequisites', () => {
    const tasks: Task[] = [
      { id: 'A', title: 'A', type: 'implementation', status: 'completed', priority: 'medium', dependencies: [], acceptanceCriteria: [], verificationRequirements: [], evidenceRequirements: [], labels: [], metadata: {}, revision: 0 },
      { id: 'B', title: 'B', type: 'implementation', status: 'ready', priority: 'medium', dependencies: [{ taskId: 'A', kind: 'requires' }], acceptanceCriteria: [], verificationRequirements: [], evidenceRequirements: [], labels: [], metadata: {}, revision: 0 },
      { id: 'C', title: 'C', type: 'implementation', status: 'ready', priority: 'medium', dependencies: [{ taskId: 'B', kind: 'requires' }], acceptanceCriteria: [], verificationRequirements: [], evidenceRequirements: [], labels: [], metadata: {}, revision: 0 },
    ];
    const ready = new TaskDependencyGraph(tasks).readyTasks();
    expect(ready).toContain('B');
    expect(ready).not.toContain('C');
  });
});

describe('TASK-005..008 service', () => {
  it('creates, assigns, transitions and requires evidence for completion', () => {
    const { service } = buildService();
    service.createTask({ id: 'T1', title: 'Build API', type: 'implementation', priority: 'high', executor: { kind: 'agent', agentId: 'developer' } });
    service.assign('T1', 'dev-1');
    service.transition('T1', 'ready');
    service.transition('T1', 'in_progress');
    service.transition('T1', 'verification');

    // Completion requires recorded evidence.
    service.recordResult({ taskId: 'T1', outcome: 'success', summary: 'implemented', evidenceIds: ['ev_1', 'ev_2'] });
    expect(service.getTask('T1').status).toBe('completed');
    expect(service.getTask('T1').completedAt).toBeTruthy();
    expect(service.results('T1')).toHaveLength(1);
  });

  it('marks a task failed when the result is a failure', () => {
    const { service } = buildService();
    service.createTask({ id: 'T2', title: 'T2', type: 'implementation' });
    service.transition('T2', 'ready');
    service.transition('T2', 'in_progress');
    service.recordResult({ taskId: 'T2', outcome: 'failure', summary: 'broken' });
    expect(service.getTask('T2').status).toBe('failed');
  });

  it('emits task events', () => {
    const { service } = buildService();
    service.createTask({ id: 'T3', title: 'T3', type: 'research' });
    const types = service.events().map((e) => e.type);
    expect(types).toContain('task.created');
  });
});
