import { useCallback, useEffect, useState } from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { ApprovalView, ToolCallSummary, type ApprovalPart, type ToolCallPart } from '@vestara/ai-ui';
import { aiApi } from '../api/aiApi';

interface AgentView { id: string; name: string; role: string }
interface ApprovalViewData { id: string; runId: string; agentId: string; toolId: string; subject: string; risk: string; status: string }

export function AgentWorkspacePage() {
  const [agents, setAgents] = useState<AgentView[]>([]);
  const [approvals, setApprovals] = useState<ApprovalViewData[]>([]);
  const [runningCalls, setRunningCalls] = useState<ToolCallPart[]>([]);

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
        Agent status, tool calls and human approvals. Approvals flow through the Vestara
        Permission/Approval runtime — never through the AI provider.
      </Typography>

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
