export type { InstallationStatus, InstallationState, CreateInstallationStateInput } from './domain/state.js';
export { canTransitionInstallation, transitionInstallation, isTerminalInstallation, createInstallationState } from './domain/state.js';
export type { InstallationStore } from './store/installation-store.js';
export { InMemoryInstallationStore } from './store/installation-store.js';
export { BootstrapSecurity } from './security/bootstrap.js';
export type { BootstrapCredentials } from './security/bootstrap.js';
export type {
  OnboardingSession,
  OnboardingAnswers,
  OnboardingSessionStatus,
  CreateOnboardingSessionInput,
} from './domain/session.js';
export { OnboardingSessionModel } from './domain/session.js';
export type {
  OnboardingContributor,
  OnboardingStepDefinition,
  OnboardingValidationIssue,
  OnboardingValidationResult,
} from './domain/contributor.js';
export { OnboardingStepRegistry } from './domain/contributor.js';
export type {
  OnboardingOperation,
  OnboardingOperationKind,
  OnboardingWarning,
  OnboardingRequirement,
  OnboardingPlan,
  CreateOnboardingPlanInput,
} from './domain/plan.js';
export { createOnboardingPlan, approveOnboardingPlan, isPlanApproved } from './domain/plan.js';
export type { DeploymentProfile, DeploymentProfileId } from './domain/profile.js';
export { DEPLOYMENT_PROFILES, getProfile } from './domain/profile.js';
export type { EnvironmentDiscovery, DiscoveryStatus } from './domain/discovery.js';
export { discoverEnvironment } from './domain/discovery.js';
export type { OnboardingContext } from './service/onboarding-context.js';
export type { OnboardingServiceOptions, ApprovedSession } from './service/onboarding-service.js';
export { OnboardingService } from './service/onboarding-service.js';
export { authOwnerContributor, configContributor, generatorContributor } from './contributors/builtin.js';
export {
  marketplaceContributor,
  aiContributor,
  agentContributor,
  databaseContributor,
  workspaceContributor,
  integrationContributor,
  diagnosticsContributor,
} from './contributors/platform-contributors.js';
export type {
  ExecutionState,
  ExecutionCheckpoint,
  ExecutionStatus,
  CreateExecutionInput,
} from './domain/execution.js';
export {
  createExecutionState,
  markRunning,
  markStepStarted,
  markStepCompleted,
  markStepFailed,
  markCompleted,
  markRolledBack,
  computeExecutionEvidence,
  completedOperationsForRollback,
} from './domain/execution.js';
export type {
  OperationDispatchResult,
  OperationHandler,
} from './service/dispatcher.js';
export { OperationDispatcher } from './service/dispatcher.js';
export type {
  ExecutionStorePort,
  ExecutionSummary,
} from './service/execution-engine.js';
export { ExecutionEngine } from './service/execution-engine.js';
export type {
  VerificationStep,
  VerificationResult,
  VerificationCheck,
  ReadyPolicy,
  ReadyStatePolicy,
} from './service/verification.js';
export { VerificationPipeline, createReadyStatePolicy } from './service/verification.js';
