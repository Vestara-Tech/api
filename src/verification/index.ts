export type {
  RunVerificationOptions,
  RunVerificationResult,
  VerificationRuntimeOverrides,
  VerificationGraphIssue,
  VerificationReportSnapshot,
  VerificationScope,
} from './verification-service.js';
export { readLatestVerificationReport, runVerificationCommand } from './verification-service.js';

// DEX-CP4 — Verification Control Plane.
export type {
  VerificationPurpose,
  VerificationConclusion,
  VerificationReasonKind,
  VerificationReason,
  VerificationFreshness,
  VerificationRequest,
  VerificationVerdict,
  VerificationSourceReference,
  VerificationPlan,
  VerificationSourcePlan,
  VerificationSourceOutcome,
  VerificationControlPlane,
  DeveloperExecutionOutcome,
} from './domain/contracts.js';
export type { VerificationSource } from './domain/ports.js';
export { FastVerifyAdapter } from './adapters/fastverify-adapter.js';
export type { VctrlServiceOptions } from './service/vctrl-service.js';
export { VctrlService } from './service/vctrl-service.js';
