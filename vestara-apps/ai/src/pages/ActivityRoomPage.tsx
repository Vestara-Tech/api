import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useSearchParams } from 'react-router';
import { AgentPresence, MessageView, type VestaraMessage, type VestaraMessagePart } from '@vestara/ai-ui';
import { aiApi, type ActivityRoomExecutionPlanShape, type ActivityRoomExecutionRecordShape, type ActivityHistoryEventShape, type ActivityRoomSnapshotShape } from '../api/aiApi';
import {
  ExecutionApprovalCard,
  ExecutionBrowser,
  ExecutionEvidencePanel,
  ExecutionInspector,
  ExecutionPlanPreview,
  ExecutionPromptBar,
  ExecutionStatusPill,
  ExecutionTimeline,
} from '../app/components';

const AGENTS = [
  { id: 'vestara-planner', name: 'Planner' },
  { id: 'vestara-developer', name: 'Developer' },
  { id: 'vestara-reviewer', name: 'Reviewer' },
  { id: 'vestara-verifier', name: 'Verifier' },
  { id: 'vestara-observer', name: 'Observer' },
];

const QUICK_ACTIONS = [
  { label: 'Build the Theme Builder', goal: 'Build the Theme Builder' },
  { label: 'Generate a TypeScript script', goal: 'Generate a TypeScript script' },
  { label: 'Fix this API endpoint', goal: 'Fix this API endpoint' },
  {
    label: 'Verify current state',
    goal: 'Verify the current repository state and summarize the latest verification evidence.',
    agentId: 'vestara-verifier',
  },
] as const;

function verificationTone(report: ActivityRoomSnapshotShape['verification'] | null): 'neutral' | 'info' | 'success' | 'warning' | 'error' {
  if (!report) return 'neutral';
  if (report.result === 'pass') return 'success';
  if (report.result === 'fail') return 'error';
  return 'warning';
}

function describeActivityEvent(event: ActivityHistoryEventShape): string {
  const payload = event.payload as Record<string, unknown> | undefined;
  const detail = typeof payload?.path === 'string' ? ` (${payload.path})` : '';
  const reason =
    typeof payload?.reason === 'string'
      ? payload.reason
      : Array.isArray(payload?.reasons) && payload.reasons.length > 0
        ? String((payload.reasons[0] as Record<string, unknown>)?.message ?? '')
        : undefined;
  switch (event.type) {
    case 'execution-requested':
      return `Execution requested: ${typeof payload?.goal === 'string' ? payload.goal : ''}`;
    case 'execution-started':
      return 'Execution started on the governed runtime.';
    case 'file-changed':
      return `File changed${detail}`;
    case 'tool-requested':
      return `Tool requested: ${typeof payload?.name === 'string' ? payload.name : ''}.`;
    case 'tool-completed':
      return `Tool completed: ${typeof payload?.name === 'string' ? payload.name : ''} · ${payload?.ok === false ? 'failed' : 'ok'}.`;
    case 'context-assembled':
      return 'Developer started implementation.';
    case 'runtime-connected':
      return `Developer connected${typeof payload?.model === 'string' ? ` · ${payload.model}` : typeof payload?.runtimeId === 'string' ? ` · ${payload.runtimeId}` : ''}.`;
    case 'session-created':
      return `Developer session created${typeof payload?.sessionId === 'string' ? ` · ${payload.sessionId}` : ''}${typeof payload?.model === 'string' ? ` · ${payload.model}` : ''}.`;
    case 'session-resumed':
      return `Developer session resumed${typeof payload?.sessionId === 'string' ? ` · ${payload.sessionId}` : ''}.`;
    case 'runtime-completed':
      return `Developer runtime completed${typeof payload?.runtimeId === 'string' ? ` · ${payload.runtimeId}` : ''}.`;
    case 'verification-started':
      return 'Verification started via the control plane.';
    case 'verification-completed':
      return `Verification completed: ${String(payload?.conclusion ?? 'unknown').toUpperCase()}${reason ? ` — ${reason}` : ''}`;
    case 'evidence-recorded':
      return `Evidence recorded: ${String(payload?.evidenceHash ?? 'unknown').slice(0, 16)}…`;
    case 'execution-completed':
      return `Execution completed${typeof payload?.changedFiles === 'number' ? ` — ${payload.changedFiles} files changed` : ''}.`;
    case 'execution-blocked':
      return `Handoff blocked${reason ? `: ${reason}` : ' pending verification'}.`;
    case 'execution-failed':
      return `Execution failed${reason ? `: ${reason}` : typeof payload?.error === 'string' ? `: ${payload.error}` : ''}.`;
    case 'execution-cancelled':
      return 'Execution cancelled.';
    case 'workflow-started':
      return `Governed workflow started: ${String(payload?.workflowId ?? 'unknown')} (run ${String(payload?.workflowRunId ?? '')})`;
    case 'workflow-progressed':
      return `Workflow progressed: ${String(payload?.role ?? '')} · ${String(payload?.stepId ?? '')}`;
    case 'workflow-failed':
      return `Workflow failed${typeof payload?.error === 'string' ? `: ${payload.error}` : ''}.`;
    default:
      return `${event.type}${detail}`;
  }
}

export function ActivityRoomPage() {
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<VestaraMessage[]>([]);
  const [agentId, setAgentId] = useState('vestara-developer');
  const [goal, setGoal] = useState(() => searchParams.get('goal')?.trim() ?? '');
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ActivityRoomSnapshotShape | null>(null);
  const [preview, setPreview] = useState<ActivityRoomExecutionPlanShape | null>(null);
  const [drafts, setDrafts] = useState<readonly ActivityRoomExecutionRecordShape[]>([]);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [inspectorRefreshTrigger, setInspectorRefreshTrigger] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewRequestRef = useRef(0);

  const loadSnapshot = useCallback(async () => {
    setSnapshotLoading(true);
    try {
      const [snapshotResult, executionResult] = await Promise.allSettled([
        aiApi.activityRoomSnapshot(),
        aiApi.activityRoomExecutions(),
      ]);
      setSnapshot(snapshotResult.status === 'fulfilled' ? snapshotResult.value : null);
      setDrafts(executionResult.status === 'fulfilled' ? executionResult.value : []);
    } finally {
      setSnapshotLoading(false);
    }
  }, []);

  const append = useCallback((role: VestaraMessage['role'], parts: VestaraMessagePart[], authorName?: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `msg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
        role,
        parts,
        createdAt: new Date().toISOString(),
        ...(authorName ? { authorName } : {}),
      },
    ]);
  }, []);

  const handleApprovalDecision = useCallback(
    async (approvalId: string, approve: boolean) => {
      setApprovalBusyId(approvalId);
      setApprovalError(null);
      try {
        const endpoint = approve ? `/api/v2/approvals/${approvalId}/approve` : `/api/v2/approvals/${approvalId}/reject`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ principalId: 'console-user' }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await loadSnapshot();
      } catch (err) {
        setApprovalError(err instanceof Error ? err.message : 'Failed to update approval');
      } finally {
        setApprovalBusyId(null);
      }
    },
    [loadSnapshot],
  );

  const handleRun = async () => {
    if (!goal.trim() || running) return;
    setRunning(true);
    setRunId(null);
    append('user', [{ kind: 'text', text: goal }]);
    try {
      const run = await aiApi.activityRoomRun({ goal: goal.trim(), principalId: 'console-user' });
      setRunId(run.executionId);
      const routeLabel = run.route === 'workflow' ? 'planning/workflow' : 'developer runtime';
      append('agent', [{ kind: 'text', text: `Vestara routed this goal to the ${routeLabel} orchestration path.` }], 'Activity Orchestrator');
      if (pollRef.current) clearInterval(pollRef.current);
      let lastSequence = 0;
      pollRef.current = setInterval(async () => {
        try {
          const events = await aiApi.activityHistoryEvents(run.executionId, lastSequence);
          for (const event of events) {
            lastSequence = Math.max(lastSequence, event.sequence);
            append('agent', [{ kind: 'text', text: describeActivityEvent(event) }], 'Activity Orchestrator');
          }
          if (events.length > 0) setInspectorRefreshTrigger((n) => n + 1);
          if (events.some((event) => event.type === 'execution-completed' || event.type === 'execution-failed' || event.type === 'execution-blocked' || event.type === 'execution-cancelled')) {
            if (pollRef.current) clearInterval(pollRef.current);
            setRunning(false);
            void loadSnapshot();
          }
        } catch {
          // Keep polling until the execution resolves or the room is refreshed.
        }
      }, 500);
      void loadSnapshot();
    } catch (err) {
      append('assistant', [{ kind: 'error', message: (err as Error).message }]);
      setRunning(false);
    }
  };

  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current);
    },
    [],
  );

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    const trimmedGoal = goal.trim();
    if (!trimmedGoal) {
      setPreview(null);
      return;
    }

    setPreview(null);
    const requestId = ++previewRequestRef.current;
    const timeout = setTimeout(() => {
      void (async () => {
        try {
          const result = await aiApi.activityRoomPreview({
            goal: trimmedGoal,
            principalId: 'console-user',
          });
          if (previewRequestRef.current === requestId) setPreview(result);
        } catch {
          if (previewRequestRef.current === requestId) setPreview(null);
        }
      })();
    }, 250);

    return () => {
      clearTimeout(timeout);
    };
  }, [goal]);

  const verification = snapshot?.verification ?? null;
  const verificationLabel = verification ? verification.result.toUpperCase() : 'UNKNOWN';
  const verificationDetail = verification
    ? `Scope ${verification.scope} · ${verification.selectedTests}/${verification.executedTests} tests`
    : 'No verification report is available yet.';
  const recentItems = snapshot?.timeline ?? [];
  const recentApprovals = snapshot?.approvals ?? [];
  const chatHref = goal.trim() ? `/ai/chat?goal=${encodeURIComponent(goal.trim())}` : '/ai/chat';

  const handleQuickAction = useCallback(
    (action: (typeof QUICK_ACTIONS)[number]) => {
      if ('agentId' in action) setAgentId(action.agentId);
      setGoal(action.goal);
    },
    [],
  );

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 0.5, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Activity Room
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            A controlled narrative of human, agent, tool, workflow, and verifier activity.
          </Typography>
        </Box>
        <Button component={RouterLink} to={chatHref} variant="outlined" size="small">
          Discuss in AI Chat
        </Button>
      </Stack>

      <ExecutionPromptBar
        goal={goal}
        running={running}
        onGoalChange={setGoal}
        onRun={() => void handleRun()}
      />

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mb: 2 }}>
        {QUICK_ACTIONS.map((action) => (
          <Chip key={action.label} label={action.label} variant="outlined" clickable onClick={() => handleQuickAction(action)} />
        ))}
      </Stack>

      <ExecutionPlanPreview preview={preview} running={running} />

      <Box sx={{ mb: 2 }}>
        <AgentPresence
          agentId={agentId}
          agentName={AGENTS.find((a) => a.id === agentId)?.name ?? agentId}
          status={running ? 'running' : 'idle'}
          detail={runId ? `run ${runId}` : undefined}
        />
      </Box>

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mb: 2 }}>
        <ExecutionStatusPill label="Agents" value={String(snapshot?.counts.agents ?? 0)} tone={snapshot ? 'info' : 'neutral'} />
        <ExecutionStatusPill
          label="Active runs"
          value={String(snapshot?.counts.activeAgentRuns ?? 0)}
          tone={running ? 'warning' : snapshot && snapshot.counts.activeAgentRuns > 0 ? 'info' : 'neutral'}
          detail="Current agent activity"
        />
        <ExecutionStatusPill
          label="Approvals"
          value={String(snapshot?.counts.pendingApprovals ?? 0)}
          tone={(snapshot?.counts.pendingApprovals ?? 0) > 0 ? 'warning' : 'success'}
          detail={`${snapshot?.counts.approvals ?? 0} recorded`}
        />
        <ExecutionStatusPill label="Verification" value={verificationLabel} tone={verificationTone(verification)} detail={verificationDetail} />
      </Stack>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} sx={{ mb: 2, alignItems: 'flex-start' }}>
        <ExecutionBrowser onSelect={setSelectedExecutionId} />
        <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
          <ExecutionInspector
            executionId={selectedExecutionId}
            refreshTrigger={inspectorRefreshTrigger}
            onRefresh={() => void loadSnapshot()}
          />
          <ExecutionTimeline items={recentItems} />
        </Stack>
        <Stack spacing={2} sx={{ width: { lg: 380 }, minWidth: 0 }}>
          <ExecutionApprovalCard
            approvals={recentApprovals}
            onApprove={(approvalId) => void handleApprovalDecision(approvalId, true)}
            onReject={(approvalId) => void handleApprovalDecision(approvalId, false)}
            busyApprovalId={approvalBusyId}
            error={approvalError}
          />
          <ExecutionEvidencePanel verification={snapshot?.verification ?? null} />
        </Stack>
      </Stack>

      <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Activity stream
        </Typography>
        <Stack spacing={1}>
          {messages.map((msg, i) => (
            <MessageView key={`${msg.id}_${i}`} message={msg} onApprove={undefined} onReject={undefined} />
          ))}
          {messages.length === 0 ? (
            <Typography sx={{ color: 'text.secondary' }}>Run an agent to see its activity stream.</Typography>
          ) : null}
        </Stack>
      </Box>
    </Box>
  );
}
