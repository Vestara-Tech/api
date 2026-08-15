import { describe, expect, it } from 'vitest';
import { agentEventToParts } from '@vestara/ai-ui';

describe('ai app: agent event to Activity Room parts', () => {
  it('produces a started activity part', () => {
    const parts = agentEventToParts({ runId: 'r1', type: 'started', at: 't', data: { agentId: 'vestara-developer' } }, 'Developer');
    expect(parts[0]!.kind).toBe('agent-activity');
  });

  it('produces tool-call and approval parts', () => {
    const tool = agentEventToParts({ runId: 'r1', type: 'tool-call', at: 't', data: { tool: 'generator.apply' } }, 'Developer');
    expect(tool[0]!.kind).toBe('tool-call');

    const approval = agentEventToParts({ runId: 'r1', type: 'approval-requested', at: 't', data: { tool: 'generator.apply' } }, 'Developer');
    expect(approval[0]!.kind).toBe('approval');
    expect((approval[0] as { status: string }).status).toBe('pending');
  });

  it('produces a completed activity part', () => {
    const parts = agentEventToParts({ runId: 'r1', type: 'completed', at: 't' }, 'Developer');
    expect(parts[0]!.kind).toBe('agent-activity');
  });
});
