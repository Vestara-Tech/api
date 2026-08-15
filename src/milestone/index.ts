export type {
  MilestoneStatus,
  MilestoneHealth,
  SuccessCriterion,
  EvidenceRequirement,
  MilestoneProgress,
  Milestone,
  ProgressWeights,
  MilestoneEventType,
  MilestoneEvent,
} from './contracts.js';
export { DEFAULT_PROGRESS_WEIGHTS } from './contracts.js';
export { MilestoneStore } from './store/milestone-store.js';
export { MilestoneProgressEngine, classifyHealth } from './domain/progress-engine.js';
export type { MilestoneServiceOptions } from './service/milestone-service.js';
export { MilestoneService } from './service/milestone-service.js';
