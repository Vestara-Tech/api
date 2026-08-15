import { TaskStore } from '../task/store/task-store.js';
import { TaskService } from '../task/service/task-service.js';

export interface TaskPlatform {
  readonly store: TaskStore;
  readonly service: TaskService;
}

/** TASK — Composition root. */
export function buildTaskPlatform(): TaskPlatform {
  const store = new TaskStore();
  const service = new TaskService({ store });
  return { store, service };
}
