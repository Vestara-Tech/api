import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useSearchParams } from 'react-router';
import { AgentPresence, MessageView, type VestaraMessage, type VestaraMessagePart } from '@vestara/ai-ui';
import { agentEventToParts } from '@vestara/ai-ui';
import { aiApi, type ActivityRoomExecutionPlanShape, type ActivityRoomExecutionRecordShape, type ActivityRoomSnapshotShape, type VerificationReportShape } from '../api/aiApi';
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

function verificationTone(report: VerificationReportShape | ActivityRoomSnapshotShape['verification'] | null): 'neutral' | 'info' | 'success' | 'warning' | 'error' {
  if (!report) return 'neutral';
  if (report.result === 'pass') return 'success';
  if (report.result === 'fail') return 'error';
  return 'warning';
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
  const [verificationReport, setVerificationReport] = useState<VerificationReportShape | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewRequestRef = useRef(0);

  const loadSnapshot = useCallback(async () => {
    setSnapshotLoading(true);
    try {
      const [snapshotResult, verificationResult, executionResult] = await Promise.allSettled([
        aiApi.activityRoomSnapshot(),
        aiApi.verificationLatest(),
        aiApi.activityRoomExecutions(),
      ]);
      setSnapshot(snapshotResult.status === 'fulfilled' ? snapshotResult.value : null);
      setVerificationReport(verificationResult.status === 'fulfilled' ? verificationResult.value : null);
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
      const run = await aiApi.startAgentRun(agentId, goal.trim());
      setRunId(run.id);
      const agentName = AGENTS.find((a) => a.id === agentId)?.name ?? agentId;
      append('agent', [{ kind: 'agent-activity', agentId, agentName, activity: 'started' }], agentName);
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const events = await aiApi.agentRunEvents(run.id);
          const parts = events.flatMap((event) => agentEventToParts(event as never, agentName));
          if (parts.length > 0) {
            setMessages((prev) => {
              const prior = prev.filter((message) => message.authorName !== agentName || message.role !== 'agent');
              return [
                ...prior,
                {
                  id: `agent_${run.id}_${events.length}`,
                  role: 'agent',
                  authorName: agentName,
                  parts,
                  createdAt: new Date().toISOString(),
                },
              ];
            });
          }
          if (events.some((event) => event.type === 'completed' || event.type === 'failed')) {
            if (pollRef.current) clearInterval(pollRef.current);
            setRunning(false);
            void loadSnapshot();
          }
        } catch {
          // Keep polling until the run resolves or the room is refreshed.
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
            agentId,
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
  }, [agentId, goal]);

  const verification = verificationReport ?? snapshot?.verification ?? null;
  const verificationLabel = verification ? verification.result.toUpperCase() : 'UNKNOWN';
  const verificationDetail = verification
    ? verificationReport
      ? `${verificationReport.level} · ${verificationReport.selectedTests.length}/${verificationReport.executedTests.length} tests · ${verificationReport.graphIssues.length} graph issues`
      : `Scope ${verification.scope}`
    : 'No verification report is available yet.';
  const verificationSnapshot = snapshot?.verification ?? null;
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
        agentId={agentId}
        goal={goal}
        running={running}
        agents={AGENTS}
        onAgentChange={setAgentId}
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
        <ExecutionBrowser />
        <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
          <ExecutionInspector
            snapshot={snapshot}
            currentAgentId={agentId}
            currentAgentName={AGENTS.find((a) => a.id === agentId)?.name ?? agentId}
            running={running}
            runId={runId}
            loading={snapshotLoading}
            onRefresh={() => void loadSnapshot()}
            drafts={drafts}
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
          <ExecutionEvidencePanel verification={verificationReport} snapshotVerification={verificationSnapshot} />
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
