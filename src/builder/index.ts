export type {
  ApiDefinition,
  ApiDefinitionStatus,
  ApiResource,
  ApiField,
  ApiFieldType,
  ApiRelation,
  ApiIndex,
  ApiEndpoint,
  ApiHttpMethod,
  ApiPolicy,
  ApiOperation,
  ApiEvent,
  ApiDefinitionMetadata,
  CreateApiDefinitionInput,
  ApiDefinitionRevision,
  ValidationIssue,
  ValidationResult,
} from './domain/types.js';
export { canTransition, transition, isTerminal } from './domain/lifecycle.js';
export { DefinitionValidator } from './domain/validator.js';
export { CompatibilityAnalyzer, type CompatibilityClassification, type CompatibilityChange, type CompatibilityResult } from './domain/compatibility.js';
export { ContractCompiler, CONTRACT_COMPILER_VERSION } from './compiler/index.js';
export { hashContract, stableStringify } from './compiler/hash.js';
export { fieldSchema } from './compiler/typebox.js';
export { compileOpenApi } from './compiler/openapi.js';
export { compileRouteDefinitions, type CompiledRouteDefinition } from './compiler/routes.js';
export type { DraftStore } from './store/draft-store.js';
export { InMemoryDraftStore } from './store/in-memory.js';
export { ApiDefinitionService, type ApiDefinitionServiceOptions, type PreviewResult, type ListDefinitionsQuery, type ListDefinitionsResult } from './service/api-definition-service.js';
export type {
  ApiBuilderAiPort,
  AiBuilderProposal,
  AiBuilderGenerateRequest,
  AiBuilderModifyRequest,
  AiBuilderReviewRequest,
  AiBuilderReviewResult,
  ApiDefinitionPatch,
} from './ai/port.js';
