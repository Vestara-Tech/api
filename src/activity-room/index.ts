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

export { normalizeEvent, normalizeEvents, isInternalEvent } from './projection/event-normalizer.js';
export type { RawExecutionEvent } from './projection/event-normalizer.js';

export { classifyComplexity } from './projection/complexity-classifier.js';
export type { ComplexityClassification } from './projection/complexity-classifier.js';

export { shouldProduceMessage, toConversationMessage, filterConversationMessages } from './projection/conversation-filter.js';
export type { ConversationMessageKind, ConversationMessage } from './projection/conversation-filter.js';

export { buildProjection } from './projection/execution-projection.js';
export type { ExecutionRecord, CoordinatorResult } from './projection/execution-projection.js';
