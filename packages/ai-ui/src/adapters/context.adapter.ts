import type { ContextPart, EvidencePart } from '../model/message';

/**
 * context.adapter — maps a ContextSnapshot/bundle into a ContextPart and an
 * EvidencePart so the Activity Room can show what the agent actually saw.
 */
export function contextToPart(ctx: {
  source: string;
  title?: string;
  content: string;
  tokenEstimate?: number;
  required?: boolean;
}): ContextPart {
  return {
    kind: 'context',
    source: ctx.source,
    ...(ctx.title !== undefined ? { title: ctx.title } : {}),
    content: ctx.content,
    ...(ctx.tokenEstimate !== undefined ? { tokenEstimate: ctx.tokenEstimate } : {}),
    required: ctx.required ?? false,
  };
}

export function evidenceToPart(evidence: {
  snapshotId?: string;
  bundleHash?: string;
  summary: string;
}): EvidencePart {
  return {
    kind: 'evidence',
    ...(evidence.snapshotId !== undefined ? { snapshotId: evidence.snapshotId } : {}),
    ...(evidence.bundleHash !== undefined ? { bundleHash: evidence.bundleHash } : {}),
    summary: evidence.summary,
  };
}
