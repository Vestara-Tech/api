import { describe, it, expect } from 'vitest';
import { agentBuilderApi } from '../src/api/agentBuilderApi';

describe('agent builder registry-backed selectors', () => {
  it('exposes the API client surface', () => {
    expect(typeof agentBuilderApi.agents).toBe('function');
    expect(typeof agentBuilderApi.carRuntimes).toBe('function');
    expect(typeof agentBuilderApi.tools).toBe('function');
    expect(typeof agentBuilderApi.skills).toBe('function');
    expect(typeof agentBuilderApi.startRun).toBe('function');
    expect(typeof agentBuilderApi.runEvents).toBe('function');
  });
});
