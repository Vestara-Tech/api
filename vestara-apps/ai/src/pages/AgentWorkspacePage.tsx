import { useCallback, useEffect, useState } from 'react';
import { Box, Button, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { ApprovalView, ToolCallSummary, type ApprovalPart, type ToolCallPart } from '@vestara/ai-ui';
import { agentEventToParts } from '@vestara/ai-ui';
import { aiApi } from '../api/aiApi';

interface AgentView { id: string; name: string; role: string }
interface ApprovalViewData { id: string; runId: string; agentId: string; toolId: string; subject: string; risk: string; status: string }

export function AgentWorkspacePage() {
  const [agents, setAgents] = useState<AgentView[]>([]);
  const [approvals, setApprovals] = useState<ApprovalViewData[]>([]);
  const [runningCalls, setRunningCalls] = useState<ToolCallPart[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('vestara-developer');
  const [goal, setGoal] = useState('');
  const [running, setRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAgents(await aiApi.agents());
      setApprovals(await aiApi.approvals());
    } catch {
      // API may be down in tests
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 3000);
    return () => clearInterval(interval);
  }, [load]);

  const runDirect = async () => {
    if (!goal.trim() || running) return;
    setRunning(true);
    setRunStatus(null);
    setRunningCalls([]);
    try {
      const run = await aiApi.startAgentRun(selectedAgent, goal.trim(), 'console-user');
      setRunStatus(`started ${run.status}`);
      const poll = setInterval(async () => {
        try {
          const events = await aiApi.agentRunEvents(run.id);
          setRunningCalls(events.flatMap((event) => agentEventToParts(event as never, selectedAgent)).filter((part): part is ToolCallPart => part.kind === 'tool-call'));
          if (events.some((event) => event.type === 'completed' || event.type === 'failed')) {
            clearInterval(poll);
            setRunning(false);
            const terminal = events.find((event) => event.type === 'completed' || event.type === 'failed');
            setRunStatus(terminal?.type === 'completed' ? 'completed' : 'failed');
          }
        } catch {
          // Keep polling until the direct run resolves.
        }
      }, 500);
    } catch (err) {
      setRunStatus(`error: ${(err as Error).message}`);
      setRunning(false);
    }
  };

  const decide = async (approval: ApprovalViewData, approve: boolean) => {
    const endpoint = approve ? `/api/v2/approvals/${approval.id}/approve` : `/api/v2/approvals/${approval.id}/reject`;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ principalId: 'console-user' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      void load();
    } catch (err) {
      setApprovals((prev) => prev.map((a) => (a.id === approval.id ? { ...a, status: approve ? 'approved' : 'rejected' } : a)));
    }
  };

  const approvalParts: ApprovalPart[] = approvals.map((a) => ({
    kind: 'approval',
    approvalId: a.id,
    toolId: a.toolId,
    subject: a.subject,
    risk: a.risk,
    status: a.status as ApprovalPart['status'],
  }));

  return (
    <Box sx={{ p: 3, maxWidth: 900 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Agent Workspace
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Explicit agent-level execution with direct model/runtime diagnostics. Unlike the Activity Room,
        which routes goals through the governed orchestration boundary, runs here target a specific agent
        and surface the underlying runtime state.
      </Typography>

      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
        Direct agent run
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          select
          size="small"
          label="Agent"
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          {agents.map((agent) => (
            <MenuItem key={agent.id} value={agent.id}>
              {agent.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          fullWidth
          label="Objective"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void runDirect();
          }}
        />
        <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={() => void runDirect()} disabled={running || !goal.trim()}>
          {running ? 'Running…' : 'Run Agent'}
        </Button>
      </Stack>
      {runStatus ? (
        <Typography variant="caption" sx={{ display: 'block', mb: 2, color: 'text.secondary' }}>
          Status: {runStatus}
        </Typography>
      ) : null}

      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
        Agents
      </Typography>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mb: 3 }}>
        {agents.map((a) => (
          <Chip key={a.id} label={`${a.name} (${a.role})`} variant="outlined" />
        ))}
        {agents.length === 0 ? <Typography variant="caption" sx={{ color: 'text.secondary' }}>No agents loaded.</Typography> : null}
      </Stack>

      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
        Tool calls ({runningCalls.length})
      </Typography>
      <Box sx={{ mb: 3 }}>
        <ToolCallSummary calls={runningCalls} />
      </Box>

      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: 'text.secondary', mb: 1 }}>
        Approvals ({approvalParts.filter((a) => a.status === 'pending').length} pending)
      </Typography>
      <Stack spacing={1}>
        {approvalParts.map((part) => (
          <ApprovalView key={part.approvalId} approval={part} onApprove={(id) => void decide(approvals.find((a) => a.id === id)!, true)} onReject={(id) => void decide(approvals.find((a) => a.id === id)!, false)} />
        ))}
        {approvalParts.length === 0 ? (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            No approvals pending.
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}
