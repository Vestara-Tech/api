import type { Job, JobCompletion, JobError, JobFilter, JobMetadata, JobSource, JobStatus, EnqueueJobInput } from '../contracts.js';

/** WKR-003 — Persistence port for worker jobs. */
export interface JobStore {
  enqueue<TPayload = unknown, TMetadata extends JobMetadata = JobMetadata>(
    input: EnqueueJobInput<TPayload, TMetadata>,
  ): Job<TPayload, TMetadata>;

  claim(statuses?: readonly JobStatus[]): Job | null;

  complete(id: string, completion?: JobCompletion): Job;

  retry(id: string, nextRetryAt: string | Date, error?: JobError): Job;

  cancel(id: string, reason?: string): Job;

  get(id: string): Job;

  list(filter?: JobFilter): readonly Job[];

  count(filter?: JobFilter): number;

  purgeCompleted(before: string | Date): number;
}

export type ClaimableJobStatus = JobStatus;

export interface ClaimableJobFilter extends JobFilter {
  readonly availableBefore?: string | Date;
}

export interface JobStoreClock {
  readonly now?: () => Date;
}

export type JobStoreLike = JobStore;
