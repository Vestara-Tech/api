/** Vestara message part vocabulary — richer than a chat message. */

export interface TextPart {
  readonly kind: 'text';
  readonly text: string;
}

export interface CodePart {
  readonly kind: 'code';
  readonly code: string;
  readonly language?: string;
}

export interface FilePart {
  readonly kind: 'file';
  readonly name: string;
  readonly path: string;
  readonly mimeType?: string;
  readonly size?: number;
}

export interface ImagePart {
  readonly kind: 'image';
  readonly url?: string;
  readonly alt?: string;
}

export interface ToolCallPart {
  readonly kind: 'tool-call';
  readonly toolCallId: string;
  readonly name: string;
  readonly arguments: unknown;
  readonly status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface ToolResultPart {
  readonly kind: 'tool-result';
  readonly toolCallId: string;
  readonly ok: boolean;
  readonly output?: unknown;
  readonly error?: string;
}

export interface ApprovalPart {
  readonly kind: 'approval';
  readonly approvalId: string;
  readonly toolId: string;
  readonly subject: string;
  readonly risk: string;
  readonly status: 'pending' | 'approved' | 'rejected';
}

export interface AgentActivityPart {
  readonly kind: 'agent-activity';
  readonly agentId: string;
  readonly agentName: string;
  readonly activity: string;
  readonly detail?: string;
}

export interface WorkflowPart {
  readonly kind: 'workflow';
  readonly workflowId: string;
  readonly runId?: string;
  readonly stage: string;
  readonly status: string;
}

export interface ArtifactPart {
  readonly kind: 'artifact';
  readonly artifactId: string;
  readonly name: string;
  readonly path?: string;
  readonly summary?: string;
}

export interface EvidencePart {
  readonly kind: 'evidence';
  readonly snapshotId?: string;
  readonly bundleHash?: string;
  readonly summary: string;
}

export interface ContextPart {
  readonly kind: 'context';
  readonly source: string;
  readonly title?: string;
  readonly content: string;
  readonly tokenEstimate?: number;
  readonly required: boolean;
}

export interface GenerationPart {
  readonly kind: 'generation';
  readonly generatorId: string;
  readonly status: string;
  readonly summary?: string;
}

export interface ErrorPart {
  readonly kind: 'error';
  readonly message: string;
}

export type VestaraMessagePart =
  | TextPart
  | CodePart
  | FilePart
  | ImagePart
  | ToolCallPart
  | ToolResultPart
  | ApprovalPart
  | AgentActivityPart
  | WorkflowPart
  | ArtifactPart
  | EvidencePart
  | ContextPart
  | GenerationPart
  | ErrorPart;

export type MessageRole = 'user' | 'assistant' | 'agent' | 'system';

export interface VestaraMessage {
  readonly id: string;
  readonly role: MessageRole;
  readonly authorId?: string;
  readonly authorName?: string;
  readonly parts: readonly VestaraMessagePart[];
  readonly createdAt: string;
}

export function createMessage(role: MessageRole, parts: readonly VestaraMessagePart[], authorName?: string): VestaraMessage {
  return {
    id: `msg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    role,
    parts,
    createdAt: new Date().toISOString(),
    ...(authorName !== undefined ? { authorName } : {}),
  };
}
