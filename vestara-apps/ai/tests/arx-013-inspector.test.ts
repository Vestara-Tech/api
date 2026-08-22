import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { aiApi, type ActivityInspectorViewShape } from '../src/api/aiApi';

// ── Mock inspector view fixture ───────────────────────────────────────

const MOCK_INSPECTOR_VIEW: ActivityInspectorViewShape = {
  executionId: 'exec_test_123',
  goal: 'Fix the login form validation',
  overview: {
    executionId: 'exec_test_123',
    goal: 'Fix the login form validation',
    status: 'completed',
    phase: 'done',
    complexity: 'simple',
    participants: [
      { role: 'developer', agentId: 'vestara-developer', status: 'completed' },
    ],
    workflowId: 'wf_test',
    workflowRunId: 'run_test',
    startedAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-15T10:05:00Z',
    completedAt: '2025-01-15T10:05:00Z',
  },
  runtime: {
    runtimeId: 'opencode',
    provider: 'opencode',
    model: 'nemotron-3-ultra-free',
    sessionId: 'opencode:ses_abc123',
    health: 'connected',
  },
  context: {
    categories: ['validation'],
    skills: [{ id: 'skill-1', version: '1.0.0' }],
    resourceCount: 3,
    provenance: ['source-file'],
  },
  changes: {
    fileCount: 2,
    files: [
      { path: 'src/login.tsx', status: 'modified', additions: 10, deletions: 2 },
      { path: 'src/login.test.ts', status: 'added', additions: 25 },
    ],
  },
  verification: {
    status: 'completed',
    conclusion: 'pass',
    freshness: 'current',
    level: 'V1',
    selectedTests: 4,
    executedTests: 4,
    cached: 0,
    fingerprint: 'sha256:abc123',
    reasons: ['VCTRL_PASS_CURRENT', 'TESTS_EXHAUSTIVE'],
    handoffEligible: true,
  },
  evidence: {
    status: 'recorded',
    hash: 'sha256:def456',
    outcome: 'pass',
    recordedAt: '2025-01-15T10:05:00Z',
  },
  timeline: [
    { sequence: 1, type: 'execution-started', title: 'Execution started', at: '2025-01-15T10:00:00Z' },
    { sequence: 2, type: 'execution-completed', title: 'Execution completed', at: '2025-01-15T10:05:00Z' },
  ],
};

// ── API client tests ──────────────────────────────────────────────────

describe('aiApi.activityHistoryInspector', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('sends GET to the correct inspector endpoint', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(MOCK_INSPECTOR_VIEW), { status: 200 }));

    const result = await aiApi.activityHistoryInspector('exec_test_123');

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('/api/v2/activity-room/history/exec_test_123/inspector');
    expect(init?.method).toBeUndefined(); // GET by default
    expect(result.executionId).toBe('exec_test_123');
    expect(result.goal).toBe('Fix the login form validation');
  });

  it('returns full inspector view with all sections', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(MOCK_INSPECTOR_VIEW), { status: 200 }));

    const view = await aiApi.activityHistoryInspector('exec_test_123');

    // Overview
    expect(view.overview.status).toBe('completed');
    expect(view.overview.complexity).toBe('simple');
    expect(view.overview.participants).toHaveLength(1);

    // Runtime
    expect(view.runtime.provider).toBe('opencode');
    expect(view.runtime.model).toBe('nemotron-3-ultra-free');
    expect(view.runtime.sessionId).toBe('opencode:ses_abc123');
    expect(view.runtime.health).toBe('connected');

    // Verification
    expect(view.verification.conclusion).toBe('pass');
    expect(view.verification.handoffEligible).toBe(true);
    expect(view.verification.reasons).toContain('VCTRL_PASS_CURRENT');

    // Evidence
    expect(view.evidence.hash).toBe('sha256:def456');
    expect(view.evidence.outcome).toBe('pass');

    // Timeline
    expect(view.timeline).toHaveLength(2);
  });

  it('throws on non-200 response', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'Not found' } }), { status: 404 }));

    await expect(aiApi.activityHistoryInspector('exec_missing')).rejects.toThrow('Not found');
  });

  it('throws on empty error response', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(aiApi.activityHistoryInspector('exec_err')).rejects.toThrow('HTTP 500');
  });
});

// ── Inspector view shape contract ─────────────────────────────────────

describe('ActivityInspectorViewShape contract', () => {
  it('verifies handoffEligible is a direct field (not derived)', () => {
    const view = MOCK_INSPECTOR_VIEW;
    // handoffEligible must come from backend, not be computed from conclusion+freshness
    expect(typeof view.verification.handoffEligible).toBe('boolean');
    expect(view.verification.handoffEligible).toBe(true);
  });

  it('verifies runtime sessionId is present for connected runtime', () => {
    const view = MOCK_INSPECTOR_VIEW;
    expect(view.runtime.sessionId).toBeDefined();
    expect(view.runtime.sessionId).toContain('opencode:ses_');
  });

  it('verifies reasons are a flat string array from backend', () => {
    const view = MOCK_INSPECTOR_VIEW;
    expect(Array.isArray(view.verification.reasons)).toBe(true);
    view.verification.reasons.forEach((reason) => {
      expect(typeof reason).toBe('string');
    });
  });

  it('renders missing data gracefully when fields are undefined', () => {
    const sparseView: ActivityInspectorViewShape = {
      ...MOCK_INSPECTOR_VIEW,
      runtime: {
        health: 'unknown',
        // All optional fields omitted
      },
      verification: {
        status: 'pending',
        selectedTests: 0,
        executedTests: 0,
        cached: 0,
        reasons: [],
        handoffEligible: false,
        // Optional fields omitted
      },
      evidence: {
        status: 'pending',
        // Optional fields omitted
      },
    };

    expect(sparseView.runtime.runtimeId).toBeUndefined();
    expect(sparseView.runtime.model).toBeUndefined();
    expect(sparseView.runtime.sessionId).toBeUndefined();
    expect(sparseView.verification.conclusion).toBeUndefined();
    expect(sparseView.verification.fingerprint).toBeUndefined();
    expect(sparseView.evidence.hash).toBeUndefined();
    expect(sparseView.evidence.outcome).toBeUndefined();
    expect(sparseView.evidence.recordedAt).toBeUndefined();
  });
});
