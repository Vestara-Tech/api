/** IMG-039/040 — Persistent BuildRun with stage checkpoints and resume. */

import { randomId } from '../../core/identifiers.js';
import type { ImageBuildStage } from './lifecycle.js';
import { stageOrder } from './lifecycle.js';

export type BuildRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type BuildStageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface BuildStageRun {
  readonly stage: ImageBuildStage;
  readonly status: BuildStageStatus;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly durationMs?: number;
  readonly log: readonly string[];
  readonly error?: string;
  readonly retries: number;
  readonly checkpointed: boolean;
}

export interface BuildRun {
  readonly id: string;
  readonly profileId: string;
  readonly target: string;
  readonly status: BuildRunStatus;
  readonly stages: readonly BuildStageRun[];
  readonly createdAt: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly error?: string;
  readonly resumedFromStage?: ImageBuildStage;
}

export interface BuildRunStorePort {
  save(run: BuildRun): void;
  get(id: string): BuildRun | undefined;
  list(): readonly BuildRun[];
}

export class InMemoryBuildRunStore implements BuildRunStorePort {
  private readonly runs = new Map<string, BuildRun>();

  save(run: BuildRun): void {
    this.runs.set(run.id, run);
  }

  get(id: string): BuildRun | undefined {
    return this.runs.get(id);
  }

  list(): readonly BuildRun[] {
    return [...this.runs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

/**
 * IMG-039 — BuildRun controller. Owns the run lifecycle and per-stage state,
 * persists every stage transition (checkpoint), and supports resuming a build
 * from its last completed stage instead of restarting a 30-minute build.
 */
export class BuildRunController {
  private readonly store: BuildRunStorePort;

  constructor(store: BuildRunStorePort = new InMemoryBuildRunStore()) {
    this.store = store;
  }

  create(options: { profileId: string; target: string; resumedFromStage?: ImageBuildStage }): BuildRun {
    const resumeFrom = options.resumedFromStage;
    let stages: readonly BuildStageRun[] = stageOrder().map((stage) => ({
      stage,
      status: 'pending',
      log: [],
      retries: 0,
      checkpointed: resumeFrom !== undefined && stageIndex(stage) < stageIndex(resumeFrom),
    }));
    // Mark all stages before the resume point as completed checkpoints.
    if (resumeFrom !== undefined) {
      stages = stages.map((s) =>
        stageIndex(s.stage) < stageIndex(resumeFrom) ? { ...s, status: 'completed' as const, checkpointed: true } : s,
      );
    }
    const run: BuildRun = {
      id: randomId('run'),
      profileId: options.profileId,
      target: options.target,
      status: 'queued',
      stages,
      createdAt: new Date().toISOString(),
      ...(resumeFrom !== undefined ? { resumedFromStage: resumeFrom } : {}),
    };
    this.store.save(run);
    return run;
  }

  get(id: string): BuildRun {
    const run = this.store.get(id);
    if (!run) throw new Error(`Build run "${id}" not found`);
    return run;
  }

  list(): readonly BuildRun[] {
    return this.store.list();
  }

  start(id: string): BuildRun {
    return this.update(id, { status: 'running', startedAt: new Date().toISOString() });
  }

  markStageRunning(id: string, stage: ImageBuildStage): BuildRun {
    const run = this.get(id);
    const stages = run.stages.map((s) => (s.stage === stage ? { ...s, status: 'running' as const, startedAt: new Date().toISOString() } : s));
    return this.update(id, { stages });
  }

  markStageCompleted(id: string, stage: ImageBuildStage, log: readonly string[] = []): BuildRun {
    const run = this.get(id);
    const now = new Date().toISOString();
    const stages = run.stages.map((s) => {
      if (s.stage !== stage) return s;
      const started = s.startedAt ?? now;
      return { ...s, status: 'completed' as const, completedAt: now, durationMs: Date.parse(now) - Date.parse(started), log, checkpointed: true };
    });
    return this.update(id, { stages });
  }

  markStageFailed(id: string, stage: ImageBuildStage, error: string): BuildRun {
    const run = this.get(id);
    const stages = run.stages.map((s) => (s.stage === stage ? { ...s, status: 'failed' as const, error } : s));
    return this.update(id, { stages, status: 'failed', error, completedAt: new Date().toISOString() });
  }

  cancel(id: string): BuildRun {
    return this.update(id, { status: 'cancelled', completedAt: new Date().toISOString() });
  }

  complete(id: string): BuildRun {
    return this.update(id, { status: 'completed', completedAt: new Date().toISOString() });
  }

  appendLog(id: string, stage: ImageBuildStage, line: string): BuildRun {
    const run = this.get(id);
    const stages = run.stages.map((s) => (s.stage === stage ? { ...s, log: [...s.log, line] } : s));
    return this.update(id, { stages });
  }

  checkpointedStages(id: string): readonly ImageBuildStage[] {
    return this.get(id).stages.filter((s) => s.checkpointed).map((s) => s.stage);
  }

  private update(id: string, patch: Partial<BuildRun>): BuildRun {
    const run = this.get(id);
    const updated = { ...run, ...patch, stages: patch.stages ?? run.stages };
    this.store.save(updated);
    return updated;
  }
}

function stageIndex(stage: ImageBuildStage): number {
  return stageOrder().indexOf(stage);
}
