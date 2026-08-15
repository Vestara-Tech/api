import { describe, expect, it } from 'vitest';
import { createMessage } from '../src/model/message';
import { streamEventToParts, approvalToPart } from '../src/adapters/ai.adapter';
import { agentEventToParts } from '../src/adapters/agent.adapter';
import { contextToPart, evidenceToPart } from '../src/adapters/context.adapter';

describe('message model', () => {
  it('creates a message with a unique id and timestamp', () => {
    const a = createMessage('user', [{ kind: 'text', text: 'hi' }]);
    const b = createMessage('assistant', [{ kind: 'text', text: 'yo' }]);
    expect(a.role).toBe('user');
    expect(a.parts[0]).toEqual({ kind: 'text', text: 'hi' });
    expect(a.id).not.toBe(b.id);
    expect(a.createdAt).toBeTruthy();
  });
});

describe('ai.adapter', () => {
  it('maps a chunk event to text', () => {
    const r = streamEventToParts({ type: 'chunk', text: 'hello' });
    expect(r.text).toBe('hello');
    expect(r.done).toBe(false);
  });

  it('maps a tool-call event to a ToolCallPart', () => {
    const r = streamEventToParts({ type: 'tool-call', toolCall: { id: 'tc1', name: 'file.read', arguments: '{"path":"src/app.ts"}' } });
    expect(r.parts[0]!.kind).toBe('tool-call');
    const part = r.parts[0] as { name: string; arguments: unknown };
    expect(part.name).toBe('file.read');
    expect(part.arguments).toEqual({ path: 'src/app.ts' });
  });

  it('maps a done event', () => {
    const r = streamEventToParts({ type: 'done', modelId: 'gpt-4o', providerId: 'openai', usage: { inputTokens: 1, outputTokens: 1 } });
    expect(r.done).toBe(true);
  });

  it('maps an error event', () => {
    const r = streamEventToParts({ type: 'error', message: 'boom' });
    expect(r.error).toBe('boom');
  });
});

describe('agent.adapter', () => {
  it('maps started/tool-call/approval-requested/completed events to parts', () => {
    const started = agentEventToParts({ runId: 'r1', type: 'started', at: 't', data: { agentId: 'dev' } }, 'Developer');
    expect(started[0]!.kind).toBe('agent-activity');

    const toolCall = agentEventToParts({ runId: 'r1', type: 'tool-call', at: 't', data: { tool: 'file.read' } }, 'Developer');
    expect(toolCall[0]!.kind).toBe('tool-call');

    const approval = agentEventToParts({ runId: 'r1', type: 'approval-requested', at: 't', data: { tool: 'generator.apply' } }, 'Developer');
    expect(approval[0]!.kind).toBe('approval');
    const approvalPart = approval[0] as { status: string; subject: string };
    expect(approvalPart.status).toBe('pending');
    expect(approvalPart.subject).toContain('generator.apply');

    const completed = agentEventToParts({ runId: 'r1', type: 'completed', at: 't' }, 'Developer');
    expect(completed[0]!.kind).toBe('agent-activity');
  });
});

describe('context.adapter', () => {
  it('maps a context item to a ContextPart', () => {
    const part = contextToPart({ source: 'file', title: 'src/app.ts', content: 'code', tokenEstimate: 10, required: false });
    expect(part.kind).toBe('context');
    expect(part.title).toBe('src/app.ts');
    expect(part.tokenEstimate).toBe(10);
  });

  it('maps evidence to an EvidencePart with bundle hash', () => {
    const part = evidenceToPart({ snapshotId: 'ctx_1', bundleHash: 'a'.repeat(64), summary: 'verified' });
    expect(part.kind).toBe('evidence');
    expect(part.bundleHash).toBe('a'.repeat(64));
  });
});
