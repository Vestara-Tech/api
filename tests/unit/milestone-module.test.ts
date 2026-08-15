import { describe, expect, it } from 'vitest';
import { MilestoneService, MilestoneStore, MilestoneProgressEngine, classifyHealth } from '../../src/milestone/index.js';
import { TaskService, TaskStore } from '../../src/task/index.js';
import type { Task } from '../../src/task/contracts.js';

function buildStack() {
  const taskStore = new TaskStore();
  const taskService = new TaskService({ store: taskStore });
  const milestoneStore = new MilestoneStore();
  const progress = new MilestoneProgressEngine();
  const service = new MilestoneService({
    store: milestoneStore,
    progress,
    resolveTasks: (milestoneId) => taskService.listTasks({ milestoneId }),
    resolveChildren: (milestoneId) => milestoneStore.childrenOf(milestoneId),
  });
  return { taskStore, taskService, milestoneStore, service };
}

function task(id: string, milestoneId: string, status: Task['status'], type: Task['type'] = 'implementation'): Task {
  return { id, title: id, type, status, priority: 'medium', milestoneId, dependencies: [], acceptanceCriteria: [], verificationRequirements: [], evidenceRequirements: [], labels: [], metadata: {}, revision: 0 };
}

describe('MS-006 derived progress', () => {
  it('calculates weighted completion from task state (never PATCHed)', () => {
    const { service, taskService } = buildStack();
    service.createMilestone({ id: 'M1', title: 'M1', objective: 'x' });
    taskService.createTask({ id: 'T1', title: 'T1', type: 'implementation', milestoneId: 'M1' });
    taskService.createTask({ id: 'T2', title: 'T2', type: 'implementation', milestoneId: 'M1' });
    service.addTask('M1', 'T1');
    service.addTask('M1', 'T2');

    // Complete T1 with evidence -> progress rises.
    taskService.transition('T1', 'ready');
    taskService.transition('T1', 'in_progress');
    taskService.recordResult({ taskId: 'T1', outcome: 'success', summary: 'x', evidenceIds: ['e1'] });

    const progress = service.progressOf('M1');
    expect(progress.completedTasks).toBe(1);
    expect(progress.totalTasks).toBe(2);
    expect(progress.completion).toBeGreaterThan(0);
    expect(progress.completion).toBeLessThan(100);
  });

  it('classifies blocked milestones as blocked with critical path', () => {
    const { service, taskService } = buildStack();
    service.createMilestone({ id: 'M2', title: 'M2', objective: 'x' });
    taskService.createTask({ id: 'TA', title: 'TA', type: 'implementation', milestoneId: 'M2' });
    taskService.createTask({ id: 'TB', title: 'TB', type: 'implementation', milestoneId: 'M2' });
    service.addTask('M2', 'TA');
    service.addTask('M2', 'TB');
    taskService.transition('TA', 'ready');
    taskService.transition('TA', 'in_progress');
    taskService.transition('TA', 'blocked');

    const health = service.healthOf('M2');
    expect(health.health).toBe('blocked');
    expect(health.blockedTasks).toBe(1);
    expect(service.progressOf('M2').criticalPathTaskId).toBe('TA');
  });
});

describe('MS-007 health classification', () => {
  it('blocked dominates; started-but-not-done is at_risk', () => {
    expect(classifyHealth(1, 2, 5)).toBe('blocked');
    expect(classifyHealth(0, 2, 5)).toBe('at_risk');
    expect(classifyHealth(0, 0, 5)).toBe('healthy');
    expect(classifyHealth(0, 0, 0)).toBe('unknown');
  });
});

describe('MS-002 hierarchy', () => {
  it('tracks sub-milestones', () => {
    const { service } = buildStack();
    service.createMilestone({ id: 'ROOT', title: 'Vestara API v2', objective: 'x' });
    service.createMilestone({ id: 'API', title: 'API Platform', objective: 'x', parentMilestoneId: 'ROOT' });
    service.createMilestone({ id: 'AUTH', title: 'Auth', objective: 'x', parentMilestoneId: 'ROOT' });
    expect(service.children('ROOT').map((m) => m.id)).toEqual(['API', 'AUTH']);
  });
});

describe('MS-009 verification/evidence gate', () => {
  it('requires tasks complete + success criteria + evidence to complete', () => {
    const { service, taskService } = buildStack();
    service.createMilestone({
      id: 'M3', title: 'M3', objective: 'x',
      successCriteria: [{ id: 'c1', description: 'c1', satisfied: true }],
      evidenceRequirements: [{ id: 'e1', description: 'e1', evidenceId: 'ev_1' }],
    });
    taskService.createTask({ id: 'TC', title: 'TC', type: 'implementation', milestoneId: 'M3' });
    service.addTask('M3', 'TC');
    taskService.transition('TC', 'ready');
    taskService.transition('TC', 'in_progress');

    // Not complete: task not done.
    const gate = service.verify('M3');
    expect(gate.ok).toBe(false);
    expect(gate.reasons.some((r) => r.includes('not all tasks'))).toBe(true);

    // Complete the task with evidence.
    taskService.recordResult({ taskId: 'TC', outcome: 'success', summary: 'x', evidenceIds: ['ev_2'] });
    const after = service.verify('M3');
    expect(after.ok).toBe(true);

    const completed = service.complete('M3');
    expect(completed.milestone.status).toBe('completed');
  });

  it('rejects completion when evidence is missing', () => {
    const { service, taskService } = buildStack();
    service.createMilestone({
      id: 'M4', title: 'M4', objective: 'x',
      evidenceRequirements: [{ id: 'e1', description: 'e1' }],
    });
    taskService.createTask({ id: 'TD', title: 'TD', type: 'implementation', milestoneId: 'M4' });
    service.addTask('M4', 'TD');
    taskService.transition('TD', 'ready');
    taskService.transition('TD', 'in_progress');
    taskService.recordResult({ taskId: 'TD', outcome: 'success', summary: 'x', evidenceIds: ['ev_1'] });
    expect(() => service.complete('M4')).toThrow(/evidence requirements/);
  });
});
