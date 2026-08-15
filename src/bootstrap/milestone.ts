import { MilestoneStore } from '../milestone/store/milestone-store.js';
import { MilestoneProgressEngine } from '../milestone/domain/progress-engine.js';
import { MilestoneService } from '../milestone/service/milestone-service.js';
import type { TaskService } from '../task/service/task-service.js';

export interface MilestonePlatformOptions {
  readonly tasks: TaskService;
}

export interface MilestonePlatform {
  readonly store: MilestoneStore;
  readonly service: MilestoneService;
}

/** MS — Composition root. Milestones resolve tasks through the Task module. */
export function buildMilestonePlatform(options: MilestonePlatformOptions): MilestonePlatform {
  const store = new MilestoneStore();
  const progress = new MilestoneProgressEngine();
  const service = new MilestoneService({
    store,
    progress,
    resolveTasks: (milestoneId) => options.tasks.listTasks({ milestoneId }),
    resolveChildren: (milestoneId) => store.childrenOf(milestoneId),
  });
  return { store, service };
}
