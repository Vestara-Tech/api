import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { MessageView, AgentPresence, type VestaraMessage, type VestaraMessagePart } from '@vestara/ai-ui';
import { agentEventToParts } from '@vestara/ai-ui';
import { aiApi } from '../api/aiApi';

const AGENTS = [
  { id: 'vestara-planner', name: 'Planner' },
  { id: 'vestara-developer', name: 'Developer' },
  { id: 'vestara-reviewer', name: 'Reviewer' },
  { id: 'vestara-verifier', name: 'Verifier' },
  { id: 'vestara-observer', name: 'Observer' },
];

export function ActivityRoomPage() {
  const [messages, setMessages] = useState<VestaraMessage[]>([]);
  const [agentId, setAgentId] = useState('vestara-developer');
  const [goal, setGoal] = useState('');
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const append = useCallback((role: VestaraMessage['role'], parts: VestaraMessagePart[], authorName?: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `msg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, role, parts, createdAt: new Date().toISOString(), ...(authorName ? { authorName } : {}) },
    ]);
  }, []);

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
      // Poll events for the run.
      pollRef.current = setInterval(async () => {
        try {
          const events = await aiApi.agentRunEvents(run.id);
          const parts = events.flatMap((e) => agentEventToParts(e as never, agentName));
          if (parts.length > 0) {
            setMessages((prev) => {
              // Replace any previous activity message for this run with the accumulated view.
              const prior = prev.filter((m) => m.authorName !== agentName || m.role !== 'agent');
              return [...prior, { id: `agent_${run.id}_${events.length}`, role: 'agent', authorName: agentName, parts, createdAt: new Date().toISOString() }];
            });
          }
          if (events.some((e) => e.type === 'completed' || e.type === 'failed')) {
            if (pollRef.current) clearInterval(pollRef.current);
            setRunning(false);
          }
        } catch {
          // keep polling
        }
      }, 500);
    } catch (err) {
      append('assistant', [{ kind: 'error', message: (err as Error).message }]);
      setRunning(false);
    }
  };

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  return (
    <Box sx={{ p: 3, maxWidth: 900 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Activity Room
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        A controlled narrative of human, agent, tool and verifier activity — the same
        message-part vocabulary drives AI Chat and Agent Workspace.
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField
          select
          size="small"
          label="Agent"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          {AGENTS.map((a) => (
            <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label="Objective"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleRun(); }}
          sx={{ flex: 1 }}
        />
        <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={() => void handleRun()} disabled={running || !goal.trim()}>
          {running ? 'Running…' : 'Run Agent'}
        </Button>
      </Stack>

      <Box sx={{ mb: 2 }}>
        <AgentPresence agentId={agentId} agentName={AGENTS.find((a) => a.id === agentId)?.name ?? agentId} status={running ? 'running' : 'idle'} detail={runId ? `run ${runId}` : undefined} />
      </Box>

      <Stack spacing={1}>
        {messages.map((msg, i) => (
          <MessageView key={`${msg.id}_${i}`} message={msg} onApprove={undefined} onReject={undefined} />
        ))}
        {messages.length === 0 ? (
          <Typography sx={{ color: 'text.secondary' }}>Run an agent to see its activity stream.</Typography>
        ) : null}
      </Stack>
    </Box>
  );
}
