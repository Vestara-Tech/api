import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Box, Button, Chip, Divider, Stack, Typography } from '@mui/material';
import {
  aiApi,
  type ActivityInspectorViewShape,
  type ActivityInspectorOverviewShape,
  type ActivityInspectorRuntimeShape,
  type ActivityInspectorVerificationShape,
  type ActivityInspectorEvidenceShape,
} from '../../api/aiApi';

// ── Tone helpers ──────────────────────────────────────────────────────

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'error';
type ChipColor = 'default' | 'info' | 'success' | 'warning' | 'error';

const TONE_CHIP: Record<Tone, ChipColor> = {
  neutral: 'default',
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
};

function toneForStatus(status: string): Tone {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
    case 'cancelled':
      return 'error';
    case 'running':
    case 'verifying':
    case 'planning':
      return 'info';
    case 'awaiting-approval':
      return 'warning';
    default:
      return 'neutral';
  }
}

function toneForConclusion(conclusion: string): Tone {
  switch (conclusion) {
    case 'pass':
      return 'success';
    case 'fail':
      return 'error';
    case 'indeterminate':
      return 'warning';
    default:
      return 'neutral';
  }
}

function toneForHealth(health: string): Tone {
  switch (health) {
    case 'connected':
      return 'success';
    case 'unavailable':
      return 'error';
    default:
      return 'neutral';
  }
}

function toneForEvidenceStatus(status: string): Tone {
  switch (status) {
    case 'recorded':
      return 'success';
    case 'pending':
      return 'info';
    default:
      return 'neutral';
  }
}

// ── Section components ────────────────────────────────────────────────

function SectionHeader({ title }: { readonly title: string }) {
  return (
    <Typography
      variant="caption"
      sx={{ textTransform: 'uppercase', letterSpacing: 0.4, color: 'text.secondary', fontWeight: 600, mb: 1 }}
    >
      {title}
    </Typography>
  );
}

function FieldRow({ label, value, chip }: {
  readonly label: string;
  readonly value?: ReactNode;
  readonly chip?: { readonly label: string; readonly tone: Tone };
}) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      {chip ? (
        <Chip label={chip.label} size="small" color={TONE_CHIP[chip.tone]} />
      ) : (
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {value ?? <em style={{ color: '#999', fontStyle: 'italic', fontSize: '0.85em' }}>Not recorded</em>}
        </Typography>
      )}
    </Stack>
  );
}

// ── Overview section ──────────────────────────────────────────────────

function OverviewSection({ overview }: { readonly overview: ActivityInspectorOverviewShape }) {
  return (
    <Box>
      <SectionHeader title="Overview" />
      <FieldRow label="Status" chip={{ label: overview.status, tone: toneForStatus(overview.status) }} />
      <FieldRow label="Phase" value={overview.phase} />
      <FieldRow label="Complexity" value={overview.complexity} />
      <FieldRow label="Participants" value={`${overview.participants.length} agent${overview.participants.length !== 1 ? 's' : ''}`} />
      {overview.workflowId ? <FieldRow label="Workflow" value={overview.workflowId} /> : null}
      {overview.workflowRunId ? <FieldRow label="Run" value={overview.workflowRunId} /> : null}
      {overview.startedAt ? <FieldRow label="Started" value={new Date(overview.startedAt).toLocaleString()} /> : null}
      <FieldRow label="Updated" value={new Date(overview.updatedAt).toLocaleString()} />
      {overview.completedAt ? <FieldRow label="Completed" value={new Date(overview.completedAt).toLocaleString()} /> : null}
    </Box>
  );
}

// ── Runtime section ───────────────────────────────────────────────────

function RuntimeSection({ runtime }: { readonly runtime: ActivityInspectorRuntimeShape }) {
  return (
    <Box>
      <SectionHeader title="Runtime" />
      <FieldRow label="Runtime" value={runtime.runtimeId} />
      <FieldRow label="Provider" value={runtime.provider} />
      <FieldRow label="Model" value={runtime.model} />
      <FieldRow label="Session" value={runtime.sessionId} />
      <FieldRow label="Health" chip={{ label: runtime.health, tone: toneForHealth(runtime.health) }} />
    </Box>
  );
}

// ── Verification section ──────────────────────────────────────────────

function VerificationSection({ verification }: { readonly verification: ActivityInspectorVerificationShape }) {
  return (
    <Box>
      <SectionHeader title="Verification" />
      <FieldRow label="Status" chip={{ label: verification.status, tone: toneForStatus(verification.status) }} />
      {verification.conclusion !== undefined ? (
        <FieldRow label="Conclusion" chip={{ label: verification.conclusion, tone: toneForConclusion(verification.conclusion) }} />
      ) : (
        <FieldRow label="Conclusion" />
      )}
      <FieldRow label="Freshness" value={verification.freshness} />
      <FieldRow label="Level" value={verification.level} />
      <FieldRow label="Tests" value={`${verification.executedTests}/${verification.selectedTests} executed`} />
      {verification.cached > 0 ? <FieldRow label="Cached" value={`${verification.cached}`} /> : null}
      <FieldRow label="Fingerprint" value={verification.fingerprint} />
      <FieldRow label="Handoff eligible" chip={{ label: verification.handoffEligible ? 'yes' : 'no', tone: verification.handoffEligible ? 'success' : 'neutral' }} />
      {verification.reasons.length > 0 ? (
        <Box sx={{ mt: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', mb: 0.5 }}>
            Reasons
          </Typography>
          <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {verification.reasons.map((reason) => (
              <Chip key={reason} label={reason} size="small" variant="outlined" />
            ))}
          </Stack>
        </Box>
      ) : null}
    </Box>
  );
}

// ── Evidence section ──────────────────────────────────────────────────

function EvidenceSection({ evidence }: { readonly evidence: ActivityInspectorEvidenceShape }) {
  return (
    <Box>
      <SectionHeader title="Evidence" />
      <FieldRow label="Status" chip={{ label: evidence.status, tone: toneForEvidenceStatus(evidence.status) }} />
      <FieldRow label="Hash" value={evidence.hash} />
      <FieldRow label="Outcome" value={evidence.outcome} />
      <FieldRow label="Recorded" value={evidence.recordedAt ? new Date(evidence.recordedAt).toLocaleString() : undefined} />
    </Box>
  );
}

// ── Main component ────────────────────────────────────────────────────

export interface ExecutionInspectorProps {
  readonly executionId: string | null;
  readonly refreshTrigger?: number;
  readonly onRefresh?: () => void;
}

export function ExecutionInspector({ executionId, refreshTrigger, onRefresh }: ExecutionInspectorProps) {
  const [view, setView] = useState<ActivityInspectorViewShape | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchInspector = useCallback(async (id: string) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await aiApi.activityHistoryInspector(id);
      if (requestIdRef.current !== requestId) return;
      setView(result);
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      setError(err instanceof Error ? err.message : 'Failed to load inspector');
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!executionId) {
      setView(null);
      setError(null);
      return;
    }
    void fetchInspector(executionId);
  }, [executionId, fetchInspector]);

  // Re-fetch when refreshTrigger changes (new event arrived)
  useEffect(() => {
    if (executionId && refreshTrigger !== undefined && refreshTrigger > 0) {
      void fetchInspector(executionId);
    }
  }, [executionId, refreshTrigger, fetchInspector]);

  if (!executionId) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
          Select an execution from the browser to view inspector details.
        </Typography>
      </Box>
    );
  }

  return (
    <Box component="section" aria-label="Execution inspector" sx={{ minHeight: 200 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Inspector
        </Typography>
        <Button
          size="small"
          onClick={() => {
            void fetchInspector(executionId);
            onRefresh?.();
          }}
          disabled={loading}
        >
          Refresh
        </Button>
      </Stack>

      {error ? <Typography sx={{ color: 'error.main', mb: 1 }}>{error}</Typography> : null}

      {!loading && !error && !view ? (
        <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
          No inspector data available for this execution.
        </Typography>
      ) : null}

      {loading && !view ? (
        <Typography sx={{ color: 'text.secondary' }}>Loading inspector…</Typography>
      ) : null}

      {view ? (
        <Stack spacing={2}>
          <OverviewSection overview={view.overview} />
          <Divider />
          <RuntimeSection runtime={view.runtime} />
          <Divider />
          <VerificationSection verification={view.verification} />
          <Divider />
          <EvidenceSection evidence={view.evidence} />
        </Stack>
      ) : null}
    </Box>
  );
}
