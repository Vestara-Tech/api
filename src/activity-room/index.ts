// ARX-CP1 — Activity Room projection layer.
export type {
  ActivityExecutionStatus,
  DeveloperExecutionPhase,
  ActivityExecutionComplexity,
  ActivityParticipantProjection,
  ActivityRuntimeProjection,
  ActivityExecutionProgress,
  ActivityFileChange,
  ActivityChangeSummary,
  ActivityVerificationProjection,
  ActivityEvidenceProjection,
  ActivityTimelineEvent,
  ActivityMessageRole,
  ActivityMessagePartType,
  ActivityMessagePart,
  ActivityConversationMessage,
  ActivityExecutionProjection,
} from './projection/contracts.js';

// ARX-CP2 ARX-011 — Durable Activity history.
export type {
  ActivityEventType,
  ActivityEventPayloadMap,
  ActivityEventPayload,
  ActivityEventEnvelope,
  ActivityEvent,
  ActivityExecutionFact,
  ActivityEventInput,
  ActivityHistoryStore,
} from './history/contracts.js';
export { InMemoryActivityHistoryStore, FileActivityHistoryStore } from './history/store.js';
export { ActivityHistoryRecorderImpl } from './history/recorder.js';
export type {
  RecordExecutionInput,
  RecordCoordinatorInput,
  RecordWorkflowStartInput,
  RecordWorkflowProgressInput,
  RecordWorkflowFailureInput,
  ActivityHistoryRecorder,
} from './history/recorder.js';
export { recoverExecution, recoverEvents } from './history/recovery.js';
export type { RecoveredExecution } from './history/recovery.js';

// ARX-CP2 ARX-012 — Execution browser.
export type {
  ActivityVerificationConclusion,
  ActivityBrowserSort,
  ActivityHistoryQuery,
  ActivityExecutionSummary,
  ActivityHistoryPage,
  ActivityHistoryCursor,
} from './browse/contracts.js';
export { ActivityBrowserImpl } from './browse/browser.js';
export type { ActivityBrowser } from './browse/browser.js';

export { normalizeEvent, normalizeEvents, isInternalEvent } from './projection/event-normalizer.js';
export type { RawExecutionEvent } from './projection/event-normalizer.js';

export { classifyComplexity } from './projection/complexity-classifier.js';
export type { ComplexityClassification } from './projection/complexity-classifier.js';

export { shouldProduceMessage, toConversationMessage, filterConversationMessages } from './projection/conversation-filter.js';
export type { ConversationMessageKind, ConversationMessage } from './projection/conversation-filter.js';

export { buildProjection } from './projection/execution-projection.js';
export type { ExecutionRecord, CoordinatorResult } from './projection/execution-projection.js';

// ARX-CP2 ARX-013 — Execution Inspector v2.
export type {
  ActivityInspectorOverview,
  ActivityInspectorRuntime,
  ActivityInspectorContext,
  ActivityInspectorFileEntry,
  ActivityInspectorChanges,
  ActivityInspectorVerification,
  ActivityInspectorEvidence,
  ActivityInspectorTimelineEntry,
  ActivityInspectorView,
  ActivityInspectorEvidenceDetail,
  ActivityInspectorVerificationDetail,
  ActivityInspectorFileDiff,
} from './inspector/contracts.js';
export type { ActivityInspectorSource } from './inspector/inspector.js';
export { readInspectorSource, buildInspectorView } from './inspector/inspector.js';
export {
  resolveEvidenceDetail,
  resolveVerificationDetail,
  resolveFileDiff,
} from './inspector/detail.js';

// ARX-CP2 ARX-014 — Governed Activity Room runner.
export { GovernedActivityRunner } from './runtime/governed-runner.js';
export type {
  GovernedActivityRoute,
  GovernedActivityStartInput,
  GovernedActivityStartResult,
  GovernedActivityRunnerDeps,
} from './runtime/governed-runner.js';
