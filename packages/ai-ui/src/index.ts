// Model
export type {
  TextPart,
  CodePart,
  FilePart,
  ImagePart,
  ToolCallPart,
  ToolResultPart,
  ApprovalPart,
  AgentActivityPart,
  WorkflowPart,
  ArtifactPart,
  EvidencePart,
  ContextPart,
  GenerationPart,
  ErrorPart,
  VestaraMessagePart,
  MessageRole,
  VestaraMessage,
} from './model/message';
export { createMessage } from './model/message';

// Runtime
export type { VestaraAssistantRuntimeOptions, StreamCallbacks } from './runtime/vestara-assistant-runtime';
export { VestaraAssistantRuntime } from './runtime/vestara-assistant-runtime';

// Adapters
export { streamEventToParts, approvalToPart } from './adapters/ai.adapter';
export { agentEventToParts, workflowToPart } from './adapters/agent.adapter';
export { contextToPart, evidenceToPart } from './adapters/context.adapter';

// Components
export { MessagePartRenderer, MessageView } from './components/messages/MessageView';
export { ToolCallView, ToolCallSummary, ToolCallActions } from './components/tool-call/ToolCallView';
export { ApprovalView } from './components/approval/ApprovalView';
export { Composer } from './components/composer/Composer';
export { ArtifactView, GenerationView } from './components/artifacts/ArtifactView';
export { ReasoningView } from './components/reasoning/ReasoningView';
export { ContextInspector } from './components/context/ContextInspector';
export { ModelSelector } from './components/model/ModelSelector';
export { AgentPresence } from './components/agents/AgentPresence';
