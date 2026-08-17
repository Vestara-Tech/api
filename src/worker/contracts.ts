/** WKR-001 — Worker module contracts. */

export type JobSource = 'manual' | 'event' | 'schedule' | 'system';

export type JobStatus = 'pending' | 'running' | 'retrying' | 'completed' | 'failed' | 'cancelled';

export type RetryPolicy = 'none' | 'fixed' | 'exponential';

export type JobMetadata = Readonly<Record<string, unknown>>;

export interface WorkerRetryConfig {
  readonly policy: RetryPolicy;
  readonly delayMs: number;
  readonly maxAttempts: number;
  readonly maxDelayMs: number;
}

export interface WorkerConfig {
  readonly pollIntervalMs: number;
  readonly concurrency: number;
  readonly scheduleTickMs: number;
  readonly completedJobTtlMs: number;
  readonly retry: WorkerRetryConfig;
}

export const DEFAULT_WORKER_CONFIG: WorkerConfig = {
  pollIntervalMs: 1_000,
  concurrency: 1,
  scheduleTickMs: 60_000,
  completedJobTtlMs: 24 * 60 * 60 * 1_000,
  retry: {
    policy: 'exponential',
    delayMs: 1_000,
    maxAttempts: 3,
    maxDelayMs: 60_000,
  },
};

export function resolveWorkerConfig(input?: Partial<WorkerConfig>): WorkerConfig {
  return {
    ...DEFAULT_WORKER_CONFIG,
    ...(input ?? {}),
    retry: {
      ...DEFAULT_WORKER_CONFIG.retry,
      ...(input?.retry ?? {}),
    },
  };
}

export interface JobError {
  readonly code: string;
  readonly message: string;
  readonly details?: JobMetadata;
}

export interface JobCompletion {
  readonly output?: unknown;
  readonly error?: JobError;
}

export interface JobBinding<TPayload = unknown> {
  readonly jobType: string;
  readonly payload: TPayload;
  readonly maxAttempts?: number;
  readonly metadata?: JobMetadata;
}

export interface Schedule<TPayload = unknown> {
  readonly id: string;
  readonly name: string;
  readonly cron: string;
  readonly enabled: boolean;
  readonly timezone?: string;
  readonly binding: JobBinding<TPayload>;
  readonly lastRunAt?: string;
  readonly nextRunAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly metadata: JobMetadata;
}

export interface ScheduleInput<TPayload = unknown> {
  readonly id?: string;
  readonly name: string;
  readonly cron: string;
  readonly enabled?: boolean;
  readonly timezone?: string;
  readonly binding: JobBinding<TPayload>;
  readonly metadata?: JobMetadata;
}

export interface Job<TPayload = unknown, TMetadata extends JobMetadata = JobMetadata> {
  readonly id: string;
  readonly type: string;
  readonly source: JobSource;
  readonly status: JobStatus;
  readonly payload: TPayload;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly availableAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly failedAt?: string;
  readonly cancelledAt?: string;
  readonly lastError?: JobError;
  readonly result?: unknown;
  readonly cancelReason?: string;
  readonly metadata: TMetadata;
  readonly scheduleId?: string;
  readonly eventType?: string;
  readonly correlationId?: string;
}

export interface EnqueueJobInput<TPayload = unknown, TMetadata extends JobMetadata = JobMetadata> {
  readonly type: string;
  readonly payload: TPayload;
  readonly source?: JobSource;
  readonly availableAt?: string | Date;
  readonly maxAttempts?: number;
  readonly metadata?: TMetadata;
  readonly scheduleId?: string;
  readonly eventType?: string;
  readonly correlationId?: string;
}

export interface JobFilter {
  readonly status?: JobStatus;
  readonly type?: string;
  readonly source?: JobSource;
  readonly scheduleId?: string;
  readonly eventType?: string;
}

export type JobHandler<TPayload = unknown, TResult = unknown> = (job: Job<TPayload>) => Promise<TResult> | TResult;
